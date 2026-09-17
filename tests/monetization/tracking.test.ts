import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { count, eq } from "drizzle-orm";
import { GET } from "@/app/api/track/click/route";
import { db } from "@/lib/db/db";
import * as schema from "@/lib/db/schema";
import { clearDb } from "../db/helpers";

beforeEach(async () => {
  await clearDb();
});

async function seedTool(values: Partial<typeof schema.tools.$inferInsert>) {
  const [category] = await db
    .insert(schema.categories)
    .values({ nameAr: "تصنيف", nameEn: "Category", slug: "cat" })
    .returning();
  const [tool] = await db
    .insert(schema.tools)
    .values({
      name: "Tracked Tool",
      slug: "tracked-tool",
      categoryId: category.id,
      status: "published",
      ...values,
    })
    .returning();
  return tool;
}

function request(query: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000/api/track/click${query}`, {
    headers,
  });
}

describe("affiliate click tracking", () => {
  it("rejects a request without a tool parameter", async () => {
    const response = await GET(request(""));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "missing_tool" });
  });

  it("returns 404 for an unknown or unpublished tool", async () => {
    await seedTool({ slug: "draft-tool", status: "draft" });
    const unknown = await GET(request("?tool=missing"));
    expect(unknown.status).toBe(404);

    const unpublished = await GET(request("?tool=draft-tool"));
    expect(unpublished.status).toBe(404);
  });

  it("returns 404 when the stored destination is not an http(s) url", async () => {
    await seedTool({ slug: "bad-url", affiliateUrl: "javascript:alert(1)" });
    const response = await GET(request("?tool=bad-url"));
    expect(response.status).toBe(404);
  });

  it("redirects to the affiliate url, records the click and never leaks the ip", async () => {
    const tool = await seedTool({
      slug: "affiliate-tool",
      affiliateUrl: "https://partner.example.com/tool?ref=aidiscovery",
      websiteUrl: "https://tool.example.com",
    });

    const response = await GET(
      request("?tool=affiliate-tool", {
        "x-forwarded-for": "203.0.113.9, 10.0.0.1",
        "user-agent": "vitest-agent",
        referer: "http://localhost:3000/tools/affiliate-tool",
      }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://partner.example.com/tool?ref=aidiscovery",
    );

    const [row] = await db
      .select()
      .from(schema.affiliateClicks)
      .where(eq(schema.affiliateClicks.toolId, tool.id));

    expect(row).toBeTruthy();
    expect(row.userAgent).toBe("vitest-agent");
    expect(row.referrer).toBe("http://localhost:3000/tools/affiliate-tool");
    expect(row.ipHash).toHaveLength(64);
    expect(row.ipHash).not.toContain("203.0.113.9");
  });

  it("falls back to the website url when no affiliate url is stored", async () => {
    await seedTool({
      slug: "website-tool",
      websiteUrl: "https://tool.example.com",
    });

    const response = await GET(request("?tool=website-tool"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://tool.example.com/");

    const [row] = await db
      .select({ value: count() })
      .from(schema.affiliateClicks);
    expect(Number(row.value)).toBe(1);
  });
});
