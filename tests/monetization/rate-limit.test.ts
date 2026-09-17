import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/track/click/route";
import { db } from "@/lib/db/db";
import * as schema from "@/lib/db/schema";
import { createRateLimiter } from "@/lib/monetization/rate-limit";
import { clearDb } from "../db/helpers";

describe("createRateLimiter", () => {
  it("allows up to the limit inside a window then blocks with a retry hint", () => {
    const limiter = createRateLimiter(3, 60_000);
    const start = 1_000_000;

    expect(limiter.check("ip", start).ok).toBe(true);
    expect(limiter.check("ip", start + 10).remaining).toBe(1);
    expect(limiter.check("ip", start + 20).ok).toBe(true);

    const blocked = limiter.check("ip", start + 30);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it("resets after the window elapses", () => {
    const limiter = createRateLimiter(1, 5_000);
    expect(limiter.check("ip", 0).ok).toBe(true);
    expect(limiter.check("ip", 1_000).ok).toBe(false);
    expect(limiter.check("ip", 6_000).ok).toBe(true);
  });

  it("tracks keys independently and never exceeds the limit", () => {
    const limiter = createRateLimiter(2, 10_000);
    expect(limiter.check("a", 0).ok).toBe(true);
    expect(limiter.check("b", 0).ok).toBe(true);
    expect(limiter.check("a", 0).ok).toBe(true);
    expect(limiter.check("a", 0).ok).toBe(false);
    expect(limiter.check("b", 0).remaining).toBe(0);
  });
});

beforeEach(async () => {
  await clearDb();
});

describe("click tracker rate limiting", () => {
  it("returns 429 with Retry-After once the per-client budget is spent", async () => {
    const [category] = await db
      .insert(schema.categories)
      .values({ nameAr: "تصنيف", nameEn: "Category", slug: "cat" })
      .returning();
    await db.insert(schema.tools).values({
      name: "Tracked Tool",
      slug: "tracked-tool",
      categoryId: category.id,
      status: "published",
      websiteUrl: "https://tool.example.com",
    });

    const max = Number(process.env.CLICK_RATE_LIMIT_MAX ?? 30);
    const request = () =>
      new NextRequest("http://localhost:3000/api/track/click?tool=tracked-tool", {
        headers: { "x-forwarded-for": "198.51.100.42" },
      });

    for (let i = 0; i < max; i += 1) {
      const response = await GET(request());
      expect(response.status).toBe(302);
    }

    const blocked = await GET(request());
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);

    const rows = await db.select().from(schema.affiliateClicks);
    expect(rows).toHaveLength(max);
    expect(rows[0].ipHash).toHaveLength(64);
  });
});
