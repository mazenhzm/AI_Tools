import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import { env, assertSafeWriteTarget } from "@/lib/env";

// ---------------------------------------------------------------------------
// Development seed data.
//
// Everything created here is CLEARLY MARKED sample/placeholder data
// (names prefixed with "[Sample]" / "[نموذج]", descriptions prefixed with
// SAMPLE markers) and tools are created in `draft` status so nothing can be
// mistaken for real, published product intelligence.
// ---------------------------------------------------------------------------

const SAMPLE_AR = "[بيانات تجريبية — ليست معلومات حقيقية]";
const SAMPLE_EN = "[SAMPLE DATA — not real product information]";

function describeTarget() {
  const u = new URL(env.databaseUrl);
  return `${u.hostname}:${u.port}${u.pathname}`;
}

async function ensureCategory(v: {
  nameAr: string;
  nameEn: string;
  slug: string;
}) {
  const [existing] = await db
    .select()
    .from(s.categories)
    .where(eq(s.categories.slug, v.slug))
    .limit(1);
  if (existing) return existing;
  const [row] = await db
    .insert(s.categories)
    .values({
      ...v,
      descriptionAr: `${SAMPLE_AR} فئة تجريبية للعرض فقط.`,
      descriptionEn: `${SAMPLE_EN} Placeholder category for development only.`,
    })
    .returning();
  return row;
}

async function ensureTag(v: { nameAr: string; slug: string }) {
  const [existing] = await db
    .select()
    .from(s.tags)
    .where(eq(s.tags.slug, v.slug))
    .limit(1);
  if (existing) return existing;
  const [row] = await db
    .insert(s.tags)
    .values({ name: v.nameAr, slug: v.slug })
    .returning();
  return row;
}

async function ensureFeature(v: {
  nameAr: string;
  nameEn: string;
  normalizedKey: string;
}) {
  const [existing] = await db
    .select()
    .from(s.features)
    .where(eq(s.features.normalizedKey, v.normalizedKey))
    .limit(1);
  if (existing) return existing;
  const [row] = await db.insert(s.features).values(v).returning();
  return row;
}

async function ensureTool(v: {
  name: string;
  slug: string;
  categoryId: string;
  descriptionAr: string;
  descriptionEn: string;
  pricingType: "free" | "freemium" | "paid" | "unknown";
}) {
  const [existing] = await db
    .select()
    .from(s.tools)
    .where(eq(s.tools.slug, v.slug))
    .limit(1);
  if (existing) return existing;
  const [row] = await db
    .insert(s.tools)
    .values({ ...v, status: "draft" })
    .returning();
  return row;
}

async function ensureSource(v: {
  name: string;
  slug: string;
  type: "rss" | "api" | "product_sources" | "official" | "manual";
  adapterKey: string;
  url?: string | null;
  config?: Record<string, unknown>;
  active?: boolean;
}) {
  const [existing] = await db
    .select()
    .from(s.sources)
    .where(eq(s.sources.slug, v.slug))
    .limit(1);
  if (existing) return existing;
  const [row] = await db
    .insert(s.sources)
    .values({
      name: v.name,
      slug: v.slug,
      type: v.type,
      adapterKey: v.adapterKey,
      url: v.url ?? null,
      config: v.config ?? {},
      active: v.active ?? true,
    })
    .returning();
  return row;
}

async function linkToolTag(toolId: string, tagId: string) {
  await db.insert(s.toolTags).values({ toolId, tagId }).onConflictDoNothing();
}

async function linkToolFeature(toolId: string, featureId: string) {
  await db
    .insert(s.toolFeatures)
    .values({ toolId, featureId })
    .onConflictDoNothing();
}

async function main() {
  assertSafeWriteTarget();
  console.log(`[seed] target database: ${describeTarget()}`);

  const categories = await Promise.all([
    ensureCategory({ nameAr: "الروبوتات والمساعدون", nameEn: "AI Chatbots & Assistants", slug: "ai-chatbots" }),
    ensureCategory({ nameAr: "توليد الصور", nameEn: "AI Image Generation", slug: "ai-image-generation" }),
    ensureCategory({ nameAr: "أدوات المطورين", nameEn: "AI for Developers", slug: "ai-for-developers" }),
    ensureCategory({ nameAr: "الإنتاجية والكتابة", nameEn: "Productivity & Writing", slug: "ai-productivity" }),
  ]);

  const tags = await Promise.all([
    ensureTag({ nameAr: "مجاني", slug: "free" }),
    ensureTag({ nameAr: "مجاني جزئياً", slug: "freemium" }),
    ensureTag({ nameAr: "مدفوع", slug: "paid" }),
    ensureTag({ nameAr: "واجهة برمجية", slug: "api" }),
    ensureTag({ nameAr: "بدون تسجيل", slug: "no-signup" }),
  ]);

  const features = await Promise.all([
    ensureFeature({ nameAr: "واجهة برمجية", nameEn: "API access", normalizedKey: "api-access" }),
    ensureFeature({ nameAr: "تعدد اللغات", nameEn: "Multilingual", normalizedKey: "multilingual" }),
    ensureFeature({ nameAr: "تعاون الفرق", nameEn: "Team collaboration", normalizedKey: "team-collaboration" }),
    ensureFeature({ nameAr: "تحليلات", nameEn: "Analytics", normalizedKey: "analytics" }),
    ensureFeature({ nameAr: "امتداد المتصفح", nameEn: "Browser extension", normalizedKey: "browser-extension" }),
  ]);

  const tools = await Promise.all([
    ensureTool({
      name: "[Sample] Chat Assistant",
      slug: "sample-chat-assistant",
      categoryId: categories[0].id,
      descriptionAr: `${SAMPLE_AR} أداة محادثة تجريبية للعرض.`,
      descriptionEn: `${SAMPLE_EN} Placeholder chat assistant.`,
      pricingType: "unknown",
    }),
    ensureTool({
      name: "[Sample] Image Generator",
      slug: "sample-image-generator",
      categoryId: categories[1].id,
      descriptionAr: `${SAMPLE_AR} أداة توليد صور تجريبية للعرض.`,
      descriptionEn: `${SAMPLE_EN} Placeholder image generator.`,
      pricingType: "unknown",
    }),
    ensureTool({
      name: "[Sample] Developer API",
      slug: "sample-developer-api",
      categoryId: categories[2].id,
      descriptionAr: `${SAMPLE_AR} واجهة مطورين تجريبية للعرض.`,
      descriptionEn: `${SAMPLE_EN} Placeholder developer API.`,
      pricingType: "unknown",
    }),
  ]);

  await linkToolTag(tools[0].id, tags[0].id);
  await linkToolTag(tools[1].id, tags[1].id);
  await linkToolTag(tools[2].id, tags[3].id);
  await linkToolFeature(tools[0].id, features[0].id);
  await linkToolFeature(tools[1].id, features[1].id);
  await linkToolFeature(tools[2].id, features[0].id);

  // Publish two clearly-marked sample tools so the public site can be rendered
  // and tested end to end. They stay obviously labelled as sample data.
  const publishedSamples = [
    {
      tool: tools[0],
      shortAr: `${SAMPLE_AR} مساعد محادثة تجريبي لاختبار واجهات الموقع.`,
      shortEn: `${SAMPLE_EN} Placeholder chat assistant for UI testing.`,
      longAr: `${SAMPLE_AR} هذا نص تجريبي طويل يُستخدم للتحقق من عرض الصفحات وتخطيطها فقط، ولا يمثل أي منتج حقيقي.`,
      pricing: "freemium" as const,
      websiteUrl: "https://example.com/sample-chat",
      affiliateUrl: "https://example.com/sample-chat?ref=aidiscovery-demo",
    },
    {
      tool: tools[1],
      shortAr: `${SAMPLE_AR} مولّد صور تجريبي لاختبار واجهات الموقع.`,
      shortEn: `${SAMPLE_EN} Placeholder image generator for UI testing.`,
      longAr: `${SAMPLE_AR} نص تجريبي إضافي لاختبار صفحات التفاصيل والقوائم، وليس وصفاً لمنتج فعلي.`,
      pricing: "free" as const,
      websiteUrl: null,
      affiliateUrl: null,
    },
  ];

  for (const sample of publishedSamples) {
    await db
      .update(s.tools)
      .set({
        status: "published",
        publishedAt: new Date(),
        isFeatured: true,
        qualityScore: "90.00",
        pricingType: sample.pricing,
        websiteUrl: sample.websiteUrl,
        affiliateUrl: sample.affiliateUrl,
        shortDescriptionAr: sample.shortAr,
        shortDescriptionEn: sample.shortEn,
        longDescriptionAr: sample.longAr,
        seoTitleAr: `${sample.tool.name} — ${SAMPLE_AR}`,
        seoDescriptionAr: sample.shortAr,
        seoTitleEn: `${sample.tool.name} — ${SAMPLE_EN}`,
        seoDescriptionEn: sample.shortEn,
        faqJson: [
          {
            questionAr: "هل هذه بيانات حقيقية؟",
            answerAr: `${SAMPLE_AR} هذه بيانات تجريبية للعرض فقط.`,
          },
          {
            questionAr: "لماذا تظهر في الموقع؟",
            answerAr: "لاختبار الصفحات والواجهات أثناء التطوير.",
          },
        ],
        updatedAt: new Date(),
      })
      .where(eq(s.tools.id, sample.tool.id));
  }

  // Demo sponsored campaign so the sponsored rendering path can be verified
  // end to end. It is labelled as sample data and points at example.com.
  const today = new Date();
  const startDate = new Date(today);
  startDate.setUTCDate(startDate.getUTCDate() - 1);
  const endDate = new Date(today);
  endDate.setUTCDate(endDate.getUTCDate() + 30);
  const campaignWindow = {
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
  };

  for (const placement of ["featured", "listings"]) {
    const [existingListing] = await db
      .select()
      .from(s.sponsoredListings)
      .where(
        and(
          eq(s.sponsoredListings.toolId, tools[0].id),
          eq(s.sponsoredListings.placement, placement),
        ),
      )
      .limit(1);
    if (existingListing) {
      await db
        .update(s.sponsoredListings)
        .set({ ...campaignWindow, campaignStatus: "active", updatedAt: new Date() })
        .where(eq(s.sponsoredListings.id, existingListing.id));
      continue;
    }
    await db.insert(s.sponsoredListings).values({
      toolId: tools[0].id,
      placement,
      ...campaignWindow,
      campaignStatus: "active",
      externalReference: `${SAMPLE_EN} demo campaign`,
    });
  }

  const sources = await Promise.all([
    ensureSource({
      name: "[Sample] Offline Feed",
      slug: "sample-offline-feed",
      type: "manual",
      adapterKey: "fixture:inline",
      config: { fixturePath: "data/fixtures/sample-feed.xml" },
      active: true,
    }),
    ensureSource({
      name: "[Sample] RSS Source (inactive)",
      slug: "sample-rss-source",
      type: "rss",
      adapterKey: "rss:generic",
      url: "https://example.com/feed.xml",
      active: false,
    }),
  ]);

  const [existingCollection] = await db
    .select()
    .from(s.collections)
    .where(eq(s.collections.slug, "sample-starter-collection"))
    .limit(1);

  const collection =
    existingCollection ??
    (
      await db
        .insert(s.collections)
        .values({
          titleAr: "[نموذج] مجموعة أدوات البداية",
          titleEn: "[Sample] Starter Tools Collection",
          slug: "sample-starter-collection",
          descriptionAr: `${SAMPLE_AR} مجموعة منسّقة تجريبية.`,
          descriptionEn: `${SAMPLE_EN} Curated placeholder collection.`,
          status: "published",
        })
        .returning()
    )[0];

  await db
    .update(s.collections)
    .set({ status: "published", updatedAt: new Date() })
    .where(eq(s.collections.id, collection.id));

  await db
    .insert(s.collectionTools)
    .values(
      tools.map((tool, position) => ({
        collectionId: collection.id,
        toolId: tool.id,
        position,
      })),
    )
    .onConflictDoNothing();

  console.log(
    `[seed] ok — categories=${categories.length} tags=${tags.length} features=${features.length} tools=${tools.length} sources=${sources.length} collection=1`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed", err);
  process.exit(1);
});