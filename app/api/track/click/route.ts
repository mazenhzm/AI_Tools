import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import { env } from "@/lib/env";
import { getClickRateLimiter } from "@/lib/monetization/rate-limit";
import { hashIp } from "@/lib/utils/hash";

export const dynamic = "force-dynamic";

function safeDestination(raw: string | null): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Affiliate click tracker. The destination is resolved from the database by
 * tool slug — never taken from the query string — so this endpoint cannot be
 * used as an open redirect. Only published tools with a stored URL qualify.
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("tool")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "missing_tool" }, { status: 400 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? null;
  const ipHash = hashIp(ip, env.authSecret || "aidiscovery");

  const limit = getClickRateLimiter().check(ipHash ?? "anonymous");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  const [tool] = await db
    .select({
      id: s.tools.id,
      affiliateUrl: s.tools.affiliateUrl,
      websiteUrl: s.tools.websiteUrl,
    })
    .from(s.tools)
    .where(and(eq(s.tools.slug, slug), eq(s.tools.status, "published")))
    .limit(1);

  const target = safeDestination(tool?.affiliateUrl ?? tool?.websiteUrl ?? null);
  if (!tool || !target) {
    return NextResponse.json({ error: "unknown_tool" }, { status: 404 });
  }

  await db.insert(s.affiliateClicks).values({
    toolId: tool.id,
    ipHash,
    userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    referrer: request.headers.get("referer")?.slice(0, 500) ?? null,
  });

  return NextResponse.redirect(target.toString(), 302);
}
