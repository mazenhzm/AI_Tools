import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import {
  createAlertSubscription,
  dispatchNotificationEvent,
  enqueueNotificationEvent,
  findActiveSubscriptionsForTarget,
  normalizeEmail,
  triggerNotificationsForPublishedUpdate,
  unsubscribeByToken,
  validateReceiver,
  verifyAlertSubscription,
} from "@/lib/notifications/service";
import type { NotificationProviderSet } from "@/lib/notifications/types";
import { clearDb } from "../db/helpers";

const logOnly: NotificationProviderSet = {
  email: {
    key: "test-log",
    async send() {
      return { ok: true, real: false, error: "test stub (not really sent)" };
    },
  },
  telegram: null,
};

async function seedProvider() {
  const [row] = await db
    .insert(s.modelProviders)
    .values({ name: "Sample Provider", slug: "sample-provider" })
    .returning();
  return row;
}

async function seedModel(providerId: string | null = null) {
  const [row] = await db
    .insert(s.models)
    .values({
      name: "Sample Model",
      providerId,
      slug: `sample-model-${Math.random()}`,
      modelIdentifier: `mid-${Math.random()}`,
      modalities: ["text"],
    })
    .returning();
  return row;
}

async function seedPublishedUpdate(modelId: string) {
  const [row] = await db
    .insert(s.modelUpdates)
    .values({
      modelId,
      kind: "context_window",
      title: "نافذة السياق: 1024 → 4096",
      contentAr: "ارتفعت نافذة السياق",
      sourceUrl: `https://sample.example.com/updates/${Date.now()}`,
      status: "published",
      publishedAt: new Date("2026-02-01T00:00:00Z"),
    })
    .returning();
  return row;
}

beforeEach(async () => {
  await clearDb();
});

describe("validateReceiver / normalizeEmail", () => {
  it("validates email, telegram chat ids and channel handles", () => {
    expect(validateReceiver("email", "User@Example.com")).toBeNull();
    expect(validateReceiver("email", "not-an-email")).not.toBeNull();
    expect(validateReceiver("telegram", "123456789")).toBeNull();
    expect(validateReceiver("telegram", "-1001234567890")).toBeNull();
    expect(validateReceiver("telegram", "@my_bot_channel")).toBeNull();
    expect(validateReceiver("telegram", "hello world")).not.toBeNull();
  });

  it("normalizes emails to lowercase", () => {
    expect(normalizeEmail("  USER@Example.COM ")).toBe("user@example.com");
  });
});

describe("createAlertSubscription", () => {
  it("creates a pending subscription with a verification token", async () => {
    const model = await seedModel();
    const result = await createAlertSubscription({
      receiver: "user@example.com",
      channel: "email",
      targetType: "model",
      targetId: model.id,
    });
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe("created");
    expect(result.subscription?.status).toBe("pending");
    expect(result.subscription?.token).toMatch(/-/);
  });

  it("rejects invalid receivers", async () => {
    const model = await seedModel();
    const result = await createAlertSubscription({
      receiver: "not-an-email",
      channel: "email",
      targetType: "model",
      targetId: model.id,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("email");
  });

  it("rejects unknown targets", async () => {
    const result = await createAlertSubscription({
      receiver: "user@example.com",
      channel: "email",
      targetType: "model",
      targetId: "00000000-0000-0000-0000-0000000000ff",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("does not exist");
  });

  it("is idempotent: duplicate returns the existing subscription", async () => {
    const model = await seedModel();
    const first = await createAlertSubscription({
      receiver: "user@example.com",
      channel: "email",
      targetType: "model",
      targetId: model.id,
    });
    const second = await createAlertSubscription({
      receiver: "user@example.com",
      channel: "email",
      targetType: "model",
      targetId: model.id,
    });
    expect(second.outcome).toBe("exists");
    expect(second.subscription?.id).toBe(first.subscription?.id);
    expect((await db.select().from(s.alertSubscriptions)).length).toBe(1);
  });

  it("reactivates an unsubscribed subscription as pending", async () => {
    const model = await seedModel();
    const first = await createAlertSubscription({
      receiver: "user@example.com",
      channel: "email",
      targetType: "model",
      targetId: model.id,
    });
    await unsubscribeByToken(first.subscription!.token);
    const reactivated = await createAlertSubscription({
      receiver: "user@example.com",
      channel: "email",
      targetType: "model",
      targetId: model.id,
    });
    expect(reactivated.outcome).toBe("reactivated");
    expect(reactivated.subscription?.id).toBe(first.subscription?.id);
    expect(reactivated.subscription?.status).toBe("pending");
  });

  it("enforces the per-receiver cap", async () => {
    const modelA = await seedModel();
    const modelB = await seedModel();
    await createAlertSubscription({
      receiver: "cap@example.com",
      channel: "email",
      targetType: "model",
      targetId: modelA.id,
      maxPerReceiver: 1,
    });
    const second = await createAlertSubscription({
      receiver: "cap@example.com",
      channel: "email",
      targetType: "model",
      targetId: modelB.id,
      maxPerReceiver: 1,
    });
    expect(second.ok).toBe(false);
    expect(second.error).toContain("limit");
  });
});

describe("verify / unsubscribe", () => {
  it("activates a pending subscription on token verification", async () => {
    const model = await seedModel();
    const created = await createAlertSubscription({
      receiver: "user@example.com",
      channel: "email",
      targetType: "model",
      targetId: model.id,
    });
    const verified = await verifyAlertSubscription(created.subscription!.token);
    expect(verified.ok).toBe(true);
    expect(verified.subscription?.status).toBe("active");
    expect(verified.subscription?.verifiedAt).toBeInstanceOf(Date);
    expect(await findActiveSubscriptionsForTarget("model", model.id)).toHaveLength(1);
  });

  it("rejects an unknown token", async () => {
    const result = await verifyAlertSubscription("00000000-0000-0000-0000-0000000000ff");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("invalid");
  });

  it("unsubscribes by token", async () => {
    const model = await seedModel();
    const created = await createAlertSubscription({
      receiver: "user@example.com",
      channel: "email",
      targetType: "model",
      targetId: model.id,
    });
    const result = await unsubscribeByToken(created.subscription!.token);
    expect(result.subscription?.status).toBe("unsubscribed");
    expect(await findActiveSubscriptionsForTarget("model", model.id)).toHaveLength(0);
  });
});

describe("notification events + dispatch", () => {
  it("enqueues exactly one event per model update", async () => {
    const model = await seedModel();
    const update = await seedPublishedUpdate(model.id);
    const first = await enqueueNotificationEvent(update.id);
    const second = await enqueueNotificationEvent(update.id);
    expect(first.id).toBe(second.id);
    expect(first.status).toBe("queued");
  });

  it("dispatches to matching active subscriptions only", async () => {
    const provider = await seedProvider();
    const model = await seedModel(provider.id);
    const update = await seedPublishedUpdate(model.id);

    const emailSub = await createAlertSubscription({
      receiver: "email@example.com",
      targetType: "model",
      targetId: model.id,
    });
    await verifyAlertSubscription(emailSub.subscription!.token);

    const pendingSub = await createAlertSubscription({
      receiver: "pending@example.com",
      targetType: "model",
      targetId: model.id,
    });
    void pendingSub;

    const event = await enqueueNotificationEvent(update.id);
    const summary = await dispatchNotificationEvent({
      eventId: event.id,
      providers: logOnly,
    });

    expect(summary.attempted).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.failed).toBe(0);
    expect(summary.newlyLogged).toBe(1);

    const logs = await db.select().from(s.notificationLogs);
    expect(logs).toHaveLength(1);
    const [log] = logs;
    expect(log.status).toBe("skipped");
    expect(log.channel).toBe("email");
  });

  it("delivers via telegram when the provider reports real:true", async () => {
    const model = await seedModel();
    const update = await seedPublishedUpdate(model.id);
    const created = await createAlertSubscription({
      receiver: "123456789",
      channel: "telegram",
      targetType: "model",
      targetId: model.id,
    });
    await verifyAlertSubscription(created.subscription!.token);

    const providers: NotificationProviderSet = {
      email: null,
      telegram: {
        key: "test-telegram",
        async send() {
          return { ok: true, real: true };
        },
      },
    };

    const event = await enqueueNotificationEvent(update.id);
    const summary = await dispatchNotificationEvent({ eventId: event.id, providers });
    expect(summary.delivered).toBe(1);
    expect(summary.failed).toBe(0);

    const [log] = await db.select().from(s.notificationLogs);
    expect(log.status).toBe("delivered");
    expect(log.channel).toBe("telegram");
  });

  it("records failed deliveries when the provider errors", async () => {
    const model = await seedModel();
    const update = await seedPublishedUpdate(model.id);
    const created = await createAlertSubscription({
      receiver: "123456789",
      channel: "telegram",
      targetType: "model",
      targetId: model.id,
    });
    await verifyAlertSubscription(created.subscription!.token);

    const providers: NotificationProviderSet = {
      email: null,
      telegram: {
        key: "failing-telegram",
        async send() {
          return { ok: false, real: true, error: "telegram API error: bad" };
        },
      },
    };

    const event = await enqueueNotificationEvent(update.id);
    const summary = await dispatchNotificationEvent({ eventId: event.id, providers });
    expect(summary.failed).toBe(1);
    expect(summary.errors).toContain("telegram API error: bad");

    const [eventRow] = await db
      .select()
      .from(s.notificationEvents)
      .where(eq(s.notificationEvents.id, event.id));
    expect(eventRow.status).toBe("failed");
    expect(eventRow.error).toContain("failed");
  });

  it("notifies a provider-level target for any model of that provider", async () => {
    const provider = await seedProvider();
    const model = await seedModel(provider.id);
    const update = await seedPublishedUpdate(model.id);

    const created = await createAlertSubscription({
      receiver: "team@example.com",
      channel: "email",
      targetType: "provider",
      targetId: provider.id,
    });
    await verifyAlertSubscription(created.subscription!.token);

    const event = await enqueueNotificationEvent(update.id);
    const summary = await dispatchNotificationEvent({ eventId: event.id, providers: logOnly });
    expect(summary.attempted).toBe(1);
    expect(summary.skipped).toBe(1);
  });

  it("is idempotent: re-dispatching an already processed event does nothing", async () => {
    const model = await seedModel();
    const update = await seedPublishedUpdate(model.id);
    const event = await enqueueNotificationEvent(update.id);
    await dispatchNotificationEvent({ eventId: event.id, providers: logOnly });
    const second = await dispatchNotificationEvent({ eventId: event.id, providers: logOnly });
    expect(second.status).toBe("delivered");
    expect(second.attempted).toBe(0);
    expect((await db.select().from(s.notificationLogs)).length).toBe(0);
  });

  it("skips dispatch while the update is not published", async () => {
    const model = await seedModel();
    const [draftUpdate] = await db
      .insert(s.modelUpdates)
      .values({
        modelId: model.id,
        kind: "metadata",
        title: "تغيير",
        status: "draft",
        sourceUrl: "https://x.example.com/u",
      })
      .returning();
    const event = await enqueueNotificationEvent(draftUpdate.id);
    const summary = await dispatchNotificationEvent({ eventId: event.id, providers: logOnly });
    expect(summary.status).toBe("skipped");
    expect(summary.errors[0]).toContain("not published");
  });
});

describe("triggerNotificationsForPublishedUpdate", () => {
  it("dispatches once and refuses a second trigger", async () => {
    const model = await seedModel();
    const update = await seedPublishedUpdate(model.id);

    const first = await triggerNotificationsForPublishedUpdate(update.id, logOnly);
    expect(first.triggered).toBe(true);

    const second = await triggerNotificationsForPublishedUpdate(update.id, logOnly);
    expect(second.triggered).toBe(false);

    expect((await db.select().from(s.notificationEvents)).length).toBe(1);
  });
});