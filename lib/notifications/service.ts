import { and, eq, inArray } from "drizzle-orm";
import { db as defaultDb, type Db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import { isUniqueViolation } from "@/lib/db/errors";
import { env } from "@/lib/env";
import {
  createEmailProviderFromEnv,
  createTelegramProvider,
} from "./providers";
import type {
  Channel,
  NotificationProviderSet,
  TargetType,
} from "./types";
import { buildModelUpdateNotification } from "./messages";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEGRAM_CHAT_RE = /^-?\d{4,18}$/;
const TELEGRAM_HANDLE_RE = /^@[A-Za-z0-9_]{3,32}$/;

export type SubStatus = (typeof s.subStatus)["enumValues"][number];
export type NotificationStatus = (typeof s.notificationStatus)["enumValues"][number];

export interface SubscribeResult {
  ok: boolean;
  error?: string;
  outcome?: "created" | "exists" | "reactivated";
  subscription?: {
    id: string;
    token: string;
    status: SubStatus;
    receiver: string;
    channel: Channel;
    targetType: TargetType;
    targetId: string;
  };
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateReceiver(channel: Channel, receiver: string): string | null {
  if (channel === "email") {
    return EMAIL_RE.test(receiver) ? null : "please provide a valid email address";
  }
  return TELEGRAM_CHAT_RE.test(receiver) || TELEGRAM_HANDLE_RE.test(receiver)
    ? null
    : "please provide a valid Telegram chat id or channel username";
}

async function targetExists(
  database: Db,
  targetType: TargetType,
  targetId: string,
): Promise<boolean> {
  if (targetType === "model") {
    const [row] = await database
      .select({ id: s.models.id })
      .from(s.models)
      .where(eq(s.models.id, targetId))
      .limit(1);
    return Boolean(row);
  }
  const [row] = await database
    .select({ id: s.modelProviders.id })
    .from(s.modelProviders)
    .where(eq(s.modelProviders.id, targetId))
    .limit(1);
  return Boolean(row);
}

async function countActiveFor(
  database: Db,
  channel: Channel,
  receiver: string,
  maxPerReceiver?: number,
): Promise<number> {
  const rows = await database
    .select({ id: s.alertSubscriptions.id })
    .from(s.alertSubscriptions)
    .where(
      and(
        eq(s.alertSubscriptions.channel, channel),
        eq(s.alertSubscriptions.receiver, receiver),
        inArray(s.alertSubscriptions.status, ["pending", "active"]),
      ),
    );
  const capped = Math.max(1, maxPerReceiver ?? env.subscriptionsMaxPerReceiver);
  return Math.min(rows.length, capped);
}

/**
 * Creates a pending change-alert subscription. Validates the receiver and that
 * the target exists, enforces a per-receiver cap, and is idempotent: an
 * existing subscription re-issues its verification token (re-activating a
 * previously unsubscribed one as pending).
 */
export async function createAlertSubscription(
  args: {
    receiver: string;
    channel?: Channel;
    targetType: TargetType;
    targetId: string;
    database?: Db;
    maxPerReceiver?: number;
  },
): Promise<SubscribeResult> {
  const database = args.database ?? defaultDb;
  const channel = args.channel ?? "email";
  const receiver =
    channel === "email" ? normalizeEmail(args.receiver) : args.receiver.trim();

  const invalid = validateReceiver(channel, receiver);
  if (invalid) return { ok: false, error: invalid };

  if (!(await targetExists(database, args.targetType, args.targetId))) {
    return { ok: false, error: "the requested target does not exist" };
  }

  if (
    (await countActiveFor(database, channel, receiver, args.maxPerReceiver)) >=
    (args.maxPerReceiver ?? env.subscriptionsMaxPerReceiver)
  ) {
    return {
      ok: false,
      error: `active subscription limit reached (${env.subscriptionsMaxPerReceiver} per address)`,
    };
  }

  const values = {
    receiver,
    channel,
    targetType: args.targetType,
    targetId: args.targetId,
  };
  try {
    const [created] = await database
      .insert(s.alertSubscriptions)
      .values(values)
      .returning();
    return {
      ok: true,
      outcome: "created",
      subscription: toSubscribeResult(created),
    };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const [existing] = await database
      .select()
      .from(s.alertSubscriptions)
      .where(
        and(
          eq(s.alertSubscriptions.receiver, receiver),
          eq(s.alertSubscriptions.channel, channel),
          eq(s.alertSubscriptions.targetType, args.targetType),
          eq(s.alertSubscriptions.targetId, args.targetId),
        ),
      )
      .limit(1);
    if (!existing) throw error;

    if (existing.status === "unsubscribed") {
      const [reactivated] = await database
        .update(s.alertSubscriptions)
        .set({ status: "pending", updatedAt: new Date() })
        .where(eq(s.alertSubscriptions.id, existing.id))
        .returning();
      return {
        ok: true,
        outcome: "reactivated",
        subscription: toSubscribeResult(reactivated),
      };
    }
    return {
      ok: true,
      outcome: "exists",
      subscription: toSubscribeResult(existing),
    };
  }
}

function toSubscribeResult(
  row: typeof s.alertSubscriptions.$inferSelect,
): SubscribeResult["subscription"] {
  return {
    id: row.id,
    token: row.token,
    status: row.status,
    receiver: row.receiver,
    channel: row.channel,
    targetType: row.targetType,
    targetId: row.targetId,
  };
}

export async function verifyAlertSubscription(
  token: string,
  database?: Db,
): Promise<{ ok: boolean; error?: string; subscription?: typeof s.alertSubscriptions.$inferSelect }> {
  const db = database ?? defaultDb;
  const [sub] = await db
    .select()
    .from(s.alertSubscriptions)
    .where(eq(s.alertSubscriptions.token, token))
    .limit(1);
  if (!sub) return { ok: false, error: "invalid verification token" };
  const [updated] = await db
    .update(s.alertSubscriptions)
    .set({ status: "active", verifiedAt: new Date() })
    .where(eq(s.alertSubscriptions.id, sub.id))
    .returning();
  return { ok: true, subscription: updated };
}

export async function unsubscribeByToken(
  token: string,
  database?: Db,
): Promise<{ ok: boolean; error?: string; subscription?: typeof s.alertSubscriptions.$inferSelect }> {
  const db = database ?? defaultDb;
  const [sub] = await db
    .select()
    .from(s.alertSubscriptions)
    .where(eq(s.alertSubscriptions.token, token))
    .limit(1);
  if (!sub) return { ok: false, error: "invalid token" };
  const [updated] = await db
    .update(s.alertSubscriptions)
    .set({ status: "unsubscribed", updatedAt: new Date() })
    .where(eq(s.alertSubscriptions.id, sub.id))
    .returning();
  return { ok: true, subscription: updated };
}

export async function findActiveSubscriptionsForTarget(
  targetType: TargetType,
  targetId: string,
  database?: Db,
): Promise<Array<typeof s.alertSubscriptions.$inferSelect>> {
  return (database ?? defaultDb)
    .select()
    .from(s.alertSubscriptions)
    .where(
      and(
        eq(s.alertSubscriptions.targetType, targetType),
        eq(s.alertSubscriptions.targetId, targetId),
        eq(s.alertSubscriptions.status, "active"),
      ),
    );
}

// ---------------------------------------------------------------------------
// Notification events + dispatch
// ---------------------------------------------------------------------------

export async function enqueueNotificationEvent(
  modelUpdateId: string,
  database?: Db,
): Promise<typeof s.notificationEvents.$inferSelect> {
  const db = database ?? defaultDb;
  const [created] = await db
    .insert(s.notificationEvents)
    .values({ modelUpdateId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [existing] = await db
    .select()
    .from(s.notificationEvents)
    .where(eq(s.notificationEvents.modelUpdateId, modelUpdateId))
    .limit(1);
  if (!existing) {
    const [row] = await db.insert(s.notificationEvents).values({ modelUpdateId }).returning();
    return row;
  }
  return existing;
}

export interface DispatchSummary {
  eventId: string;
  status: NotificationStatus;
  attempted: number;
  delivered: number;
  skipped: number;
  failed: number;
  newlyLogged: number;
  errors: string[];
}

/**
 * Dispatches one queued notification event to every matching active
 * subscription. Idempotent: a (event, subscription, channel) key is uniqued in
 * notification_logs, and an already-processed event is never re-dispatched.
 * A provider returning `ok` with `real:false` records the log as "skipped"
 * (logged only, not really delivered).
 */
export async function dispatchNotificationEvent(
  args: {
    eventId: string;
    providers: NotificationProviderSet;
    database?: Db;
    now?: () => Date;
  },
): Promise<DispatchSummary> {
  const db = args.database ?? defaultDb;
  const now = args.now ?? (() => new Date());

  const [event] = await db
    .select()
    .from(s.notificationEvents)
    .where(eq(s.notificationEvents.id, args.eventId))
    .limit(1);
  if (!event || event.status !== "queued") {
    return {
      eventId: args.eventId,
      status: event?.status ?? "skipped",
      attempted: 0,
      delivered: 0,
      skipped: 0,
      failed: 0,
      newlyLogged: 0,
      errors: [],
    };
  }

  const [update] = await db
    .select()
    .from(s.modelUpdates)
    .where(eq(s.modelUpdates.id, event.modelUpdateId))
    .limit(1);
  if (!update || update.status !== "published") {
    return {
      eventId: args.eventId,
      status: "skipped",
      attempted: 0,
      delivered: 0,
      skipped: 0,
      failed: 0,
      newlyLogged: 0,
      errors: ["update not published; nothing dispatched"],
    };
  }

  const [model] = await db
    .select()
    .from(s.models)
    .where(eq(s.models.id, update.modelId))
    .limit(1);
  if (!model) {
    return {
      eventId: args.eventId,
      status: "failed",
      attempted: 0,
      delivered: 0,
      skipped: 0,
      failed: 0,
      newlyLogged: 0,
      errors: ["referenced model no longer exists"],
    };
  }

  const providerRows = model.providerId
    ? await db
        .select()
        .from(s.modelProviders)
        .where(eq(s.modelProviders.id, model.providerId))
        .limit(1)
    : [];
  const provider = providerRows[0] ?? null;

  const modelSubs = await findActiveSubscriptionsForTarget("model", model.id, db);
  const providerSubs = provider
    ? await findActiveSubscriptionsForTarget("provider", provider.id, db)
    : [];
  const subscriptions = [...modelSubs, ...providerSubs];

  if (subscriptions.length === 0) {
    const [noSubs] = await db
      .update(s.notificationEvents)
      .set({ status: "delivered", processedAt: now(), error: null })
      .where(eq(s.notificationEvents.id, event.id))
      .returning();
    return {
      eventId: args.eventId,
      status: noSubs.status,
      attempted: 0,
      delivered: 0,
      skipped: 0,
      failed: 0,
      newlyLogged: 0,
      errors: [],
    };
  }

  const message = buildModelUpdateNotification({ model, provider, update });
  const errors: string[] = [];
  let newlyLogged = 0;

  for (const sub of subscriptions) {
    const providerForChannel =
      sub.channel === "email" ? args.providers.email : args.providers.telegram;

    let status: NotificationStatus;
    let error: string | null = null;

    if (!providerForChannel) {
      status = "skipped";
      error = "channel provider not configured";
    } else if (sub.channel === "email") {
      const result = await (providerForChannel as NonNullable<NotificationProviderSet["email"]>)
        .send({ to: sub.receiver, subject: message.subject, text: message.text });
      if (result.ok && result.real) status = "delivered";
      else if (result.ok) {
        status = "skipped";
        error = result.error ?? null;
      } else {
        status = "failed";
        error = result.error ?? null;
      }
    } else {
      const result = await (providerForChannel as NonNullable<NotificationProviderSet["telegram"]>)
        .send({ chatId: sub.receiver, text: message.text });
      if (result.ok && result.real) status = "delivered";
      else if (result.ok) {
        status = "skipped";
        error = result.error ?? null;
      } else {
        status = "failed";
        error = result.error ?? null;
      }
    }

    if (status === "failed" && error) errors.push(error);

    const [log] = await db
      .insert(s.notificationLogs)
      .values({
        eventId: event.id,
        subscriptionId: sub.id,
        channel: sub.channel,
        status,
        error,
        deliveredAt: status === "delivered" ? now() : null,
      })
      .onConflictDoNothing()
      .returning();
    if (log) newlyLogged += 1;
  }

  const logRows = await db
    .select({ status: s.notificationLogs.status })
    .from(s.notificationLogs)
    .where(eq(s.notificationLogs.eventId, event.id));
  const delivered = logRows.filter((row) => row.status === "delivered").length;
  const skipped = logRows.filter((row) => row.status === "skipped").length;
  const failed = logRows.filter((row) => row.status === "failed").length;

  const finalStatus: NotificationStatus =
    failed > 0 && delivered + skipped === 0 ? "failed" : "delivered";

  const [updatedEvent] = await db
    .update(s.notificationEvents)
    .set({
      status: finalStatus,
      processedAt: now(),
      error: failed > 0 ? `${failed} delivery(ies) failed` : null,
    })
    .where(eq(s.notificationEvents.id, event.id))
    .returning();

  return {
    eventId: args.eventId,
    status: updatedEvent.status,
    attempted: subscriptions.length,
    delivered,
    skipped,
    failed,
    newlyLogged,
    errors,
  };
}

/**
 * Ensures a queued event exists for a newly published model update and
 * dispatches it. An event that was already processed (a re-publish of the same
 * update) is left untouched — one notification per update.
 */
export async function triggerNotificationsForPublishedUpdate(
  modelUpdateId: string,
  providers: NotificationProviderSet,
  database?: Db,
): Promise<
  | { triggered: true; summary: DispatchSummary }
  | { triggered: false; reason: string }
> {
  const db = database ?? defaultDb;
  const event = await enqueueNotificationEvent(modelUpdateId, db);
  if (event.status !== "queued") {
    return { triggered: false, reason: `already processed (${event.status})` };
  }
  const summary = await dispatchNotificationEvent({
    eventId: event.id,
    providers,
    database: db,
  });
  return { triggered: true, summary };
}

/**
 * Builds the provider set for the current environment. When
 * `NOTIFICATIONS_ENABLED` is false, all providers are disabled. When SMTP is
 * not configured, the email provider is the honest log-only stub.
 * The Telegram provider only exists when a bot token is configured.
 */
export async function createNotificationProvidersFromEnv(args?: {
  overrides?: {
    email?: NotificationProviderSet["email"];
    telegram?: NotificationProviderSet["telegram"];
  };
}): Promise<NotificationProviderSet> {
  if (args?.overrides) {
    return {
      email: args.overrides.email ?? null,
      telegram: args.overrides.telegram ?? null,
    };
  }
  if (!env.notificationsEnabled) return { email: null, telegram: null };
  const configured = createEmailProviderFromEnv();
  const email = "send" in configured ? configured : null;
  const telegram = env.telegramBotToken
    ? createTelegramProvider({ token: env.telegramBotToken })
    : null;
  return { email, telegram };
}