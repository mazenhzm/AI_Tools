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
  /**
   * Trust tier (see schema `sources.authorityTier`): 5 = official API/direct
   * vendor claims, 0 = unclassified. Seeded per real source, never invented.
   */
  authorityTier?: number;
}) {
  const [existing] = await db
    .select()
    .from(s.sources)
    .where(eq(s.sources.slug, v.slug))
    .limit(1);
  if (existing) {
    if (v.authorityTier !== undefined && existing.authorityTier !== v.authorityTier) {
      await db
        .update(s.sources)
        .set({ authorityTier: v.authorityTier, updatedAt: new Date() })
        .where(eq(s.sources.id, existing.id));
    }
    return existing;
  }
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
      authorityTier: v.authorityTier ?? 0,
    })
    .returning();
  return row;
}

async function ensureProvider(v: { name: string; slug: string }) {
  const [existing] = await db
    .select()
    .from(s.modelProviders)
    .where(eq(s.modelProviders.slug, v.slug))
    .limit(1);
  if (existing) return existing;
  const [row] = await db
    .insert(s.modelProviders)
    .values(v)
    .returning();
  return row;
}

async function ensureModel(v: {
  name: string;
  slug: string;
  providerId: string | null;
  modelIdentifier: string;
  contextWindow: number | null;
  isDownloadable: boolean;
  inputPricePer1M: string | null;
  outputPricePer1M: string | null;
  currentVersion: string | null;
  websiteUrl: string | null;
  modalities: string[];
  descriptionAr: string;
}) {
  const [existing] = await db
    .select()
    .from(s.models)
    .where(eq(s.models.slug, v.slug))
    .limit(1);
  if (existing) return existing;
  const [row] = await db
    .insert(s.models)
    .values({
      ...v,
      status: "published",
      publishedAt: new Date(),
      descriptionEn: `${SAMPLE_EN} Placeholder model entry.`,
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
      // Structured developer-controlled fixture: exact but synthetic.
      authorityTier: 2,
    }),
    ensureSource({
      name: "[Sample] RSS Source (inactive)",
      slug: "sample-rss-source",
      type: "rss",
      adapterKey: "rss:generic",
      url: "https://example.com/feed.xml",
      active: false,
      // Unverified RSS feed: lowest trust.
      authorityTier: 1,
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

  // -------------------------------------------------------------------------
  // Model monitoring demo data. Clearly marked as sample/placeholder. The
  // fixture facts MATCH the seeded facts exactly so a worker run reports
  // "duplicate" (no fabricated change); one extra fixture entry ("Delta")
  // demonstrates the "created" path.
  // -------------------------------------------------------------------------
  const providers = await Promise.all([
    ensureProvider({ name: "[Sample] Acme AI", slug: "sample-acme-ai" }),
    ensureProvider({ name: "[Sample] DeepNova", slug: "sample-deepnova" }),
  ]);

  const models = await Promise.all([
    ensureModel({
      name: "[Sample] Alpha Chat",
      slug: "sample-acme-ai-sample-alpha-chat",
      providerId: providers[0].id,
      modelIdentifier: "sample-alpha-chat",
      contextWindow: 128000,
      isDownloadable: false,
      inputPricePer1M: "5.00",
      outputPricePer1M: "15.00",
      currentVersion: "1.0",
      websiteUrl: "https://example.com/alpha",
      modalities: ["text"],
      descriptionAr: `${SAMPLE_AR} نموذج محادثة تجريبي للعرض.`,
    }),
    ensureModel({
      name: "[Sample] Beta Mini",
      slug: "sample-acme-ai-sample-beta-mini",
      providerId: providers[0].id,
      modelIdentifier: "sample-beta-mini",
      contextWindow: 8000,
      isDownloadable: false,
      inputPricePer1M: "1.00",
      outputPricePer1M: "2.00",
      currentVersion: "1.2",
      websiteUrl: "https://example.com/beta",
      modalities: ["text"],
      descriptionAr: `${SAMPLE_AR} نموذج مصغّر تجريبي للعرض.`,
    }),
    ensureModel({
      name: "[Sample] Gamma Embeddings",
      slug: "sample-deepnova-sample-gamma-embeddings",
      providerId: providers[1].id,
      modelIdentifier: "sample-gamma-embeddings",
      contextWindow: 16384,
      isDownloadable: true,
      inputPricePer1M: null,
      outputPricePer1M: null,
      currentVersion: "0.9",
      websiteUrl: "https://example.com/gamma",
      modalities: ["text"],
      descriptionAr: `${SAMPLE_AR} نموذج تضمين تجريبي قابل للتنزيل.`,
    }),
  ]);

  const modelFixtureInline = JSON.stringify([
    {
      sourceItemId: "fixture-alpha-chat",
      name: "[Sample] Alpha Chat",
      modelId: "sample-alpha-chat",
      provider: "[Sample] Acme AI",
      currentVersion: "1.0",
      isDownloadable: false,
      contextWindow: 128000,
      inputPricePer1M: 5.0,
      outputPricePer1M: 15.0,
      modalities: ["text"],
      websiteUrl: "https://example.com/alpha",
      sourceUrl: "https://example.com/alpha/changelog",
      summary: `${SAMPLE_AR} مساعد محادثة تجريبي.`,
      content: `${SAMPLE_AR} نموذج محادثة تجريبي للعرض فقط.`,
      raw: {},
    },
    {
      sourceItemId: "fixture-beta-mini",
      name: "[Sample] Beta Mini",
      modelId: "sample-beta-mini",
      provider: "[Sample] Acme AI",
      currentVersion: "1.2",
      isDownloadable: false,
      contextWindow: 8000,
      inputPricePer1M: 1.0,
      outputPricePer1M: 2.0,
      modalities: ["text"],
      websiteUrl: "https://example.com/beta",
      sourceUrl: "https://example.com/beta/changelog",
      summary: `${SAMPLE_AR} نموذج مصغّر تجريبي.`,
      content: `${SAMPLE_AR} نموذج مصغّر تجريبي للعرض فقط.`,
      raw: {},
    },
    {
      sourceItemId: "fixture-gamma-embeddings",
      name: "[Sample] Gamma Embeddings",
      modelId: "sample-gamma-embeddings",
      provider: "[Sample] DeepNova",
      currentVersion: "0.9",
      isDownloadable: true,
      contextWindow: 16384,
      inputPricePer1M: null,
      outputPricePer1M: null,
      modalities: ["text"],
      websiteUrl: "https://example.com/gamma",
      sourceUrl: "https://example.com/gamma/changelog",
      summary: `${SAMPLE_AR} نموذج تضمين تجريبي.`,
      content: `${SAMPLE_AR} نموذج تضمين تجريبي للعرض فقط.`,
      raw: {},
    },
    {
      sourceItemId: "fixture-delta-vision",
      name: "[Sample] Delta Vision",
      modelId: "sample-delta-vision",
      provider: "[Sample] DeepNova",
      currentVersion: "0.1",
      isDownloadable: false,
      contextWindow: 4096,
      inputPricePer1M: null,
      outputPricePer1M: null,
      modalities: ["text", "image"],
      websiteUrl: "https://example.com/delta",
      sourceUrl: "https://example.com/delta/changelog",
      summary: `${SAMPLE_AR} نموذج رؤية تجريبي.`,
      content: `${SAMPLE_AR} نموذج رؤية تجريبي للعرض فقط.`,
      raw: {},
    },
  ]);

  const modelSource = await ensureSource({
    name: "[نموذج] مصدر نماذج تجريبي (offline)",
    slug: "sample-models-fixture",
    type: "manual",
    adapterKey: "model:fixture",
    config: { fixtureInline: modelFixtureInline },
    active: true,
    // Structured developer-controlled fixture: exact but synthetic.
    authorityTier: 2,
  });

  const hfSource = await ensureSource({
    name: "Hugging Face Model API (inactive)",
    slug: "hf-models-api",
    type: "api",
    adapterKey: "model:huggingface",
    url: "https://huggingface.co/api/models",
    config: { limit: 50 },
    active: false,
    // Official vendor API: highest trust tier.
    authorityTier: 5,
  });

  console.log(
    `[seed] ok — categories=${categories.length} tags=${tags.length} features=${features.length} tools=${tools.length} sources=${sources.length} collection=1 providers=${providers.length} models=${models.length} modelSource=${modelSource.slug} hfSource=${hfSource.slug}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed", err);
  process.exit(1);
});