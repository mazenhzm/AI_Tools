import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import { clearDb } from "../db/helpers";

class RedirectError extends Error {
  constructor(public readonly url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));

const {
  setToolStatusAction,
  reprocessToolAction,
  toggleSourceActiveAction,
} = await import("@/lib/actions/tools");
const { runIngestionAction } = await import("@/lib/actions/ingestion");

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

async function expectRedirectToLogin(
  run: () => Promise<unknown>,
): Promise<void> {
  await expect(run()).rejects.toThrowError(RedirectError);
  await expect(run()).rejects.toThrowError(/\/admin\/login/);
}

beforeEach(async () => {
  await clearDb();
});

describe("admin actions require authentication", () => {
  it("refuses status changes from anonymous callers", async () => {
    const [tool] = await db
      .insert(s.tools)
      .values({ name: "أداة", slug: "tool-anon" })
      .returning();

    await expectRedirectToLogin(() =>
      setToolStatusAction(
        formData({ toolId: tool.id, to: "pending_review" }),
      ),
    );

    const [after] = await db.select().from(s.tools);
    expect(after.status).toBe("draft");
    expect(await db.select().from(s.contentRevisions)).toHaveLength(0);
  });

  it("refuses reprocessing from anonymous callers", async () => {
    const [tool] = await db
      .insert(s.tools)
      .values({ name: "أداة", slug: "tool-anon-2" })
      .returning();
    await expectRedirectToLogin(() =>
      reprocessToolAction(formData({ toolId: tool.id })),
    );
  });

  it("refuses source changes from anonymous callers", async () => {
    const [source] = await db
      .insert(s.sources)
      .values({
        name: "مصدر",
        slug: "source-anon",
        type: "manual",
        adapterKey: "fixture:inline",
      })
      .returning();
    await expectRedirectToLogin(() =>
      toggleSourceActiveAction(formData({ sourceId: source.id })),
    );

    const [after] = await db.select().from(s.sources);
    expect(after.active).toBe(true);
  });

  it("refuses ingestion runs from anonymous callers", async () => {
    await expectRedirectToLogin(() =>
      runIngestionAction(formData({})),
    );
    expect(await db.select().from(s.ingestionRuns)).toHaveLength(0);
  });
});
