import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createEnricher } from "@/lib/ai/enrich";
import { AiProviderError, type AiProvider } from "@/lib/ai/provider";
import { db } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import { runSource } from "@/ingestion/pipeline";
import { clearDb } from "../db/helpers";
import { validEnrichment } from "./fixtures";

const noSleep = async () => {};

function scriptedProvider(responses: Array<string | Error>): AiProvider {
  let index = 0;
  return {
    name: "scripted",
    model: "scripted-1",
    async generateJson() {
      const response = responses[Math.min(index, responses.length - 1)];
      index += 1;
      if (response instanceof Error) throw response;
      return { text: response, model: "scripted-1", raw: { text: response } };
    },
  };
}

async function seedCategory(): Promise<string> {
  const [category] = await db
    .insert(s.categories)
    .values({ nameAr: "الإنتاجية", nameEn: "Productivity", slug: "ai-productivity" })
    .returning();
  return category.id;
}

async function makeSource(): Promise<string> {
  const [source] = await db
    .insert(s.sources)
    .values({
      name: "Fixture Source",
      slug: "fixture-source",
      type: "manual",
      adapterKey: "fixture:inline",
      config: { fixturePath: "tests/fixtures/rss/valid.xml" },
    })
    .returning();
  return source.id;
}

beforeEach(async () => {
  await clearDb();
});

describe("createEnricher (integration)", () => {
  it("enriches created tools, publishes high-quality output and links taxonomy", async () => {
    await seedCategory();
    const sourceId = await makeSource();
    const enrich = createEnricher({
      provider: scriptedProvider([JSON.stringify(validEnrichment())]),
      database: db,
      minScore: 80,
      sleep: noSleep,
    });

    const result = await runSource({ sourceId, enrich });

    expect(result.metrics.created).toBe(3);
    expect(result.metrics.aiProcessed).toBe(3);
    expect(result.metrics.aiFailed).toBe(0);

    const tools = await db.select().from(s.tools);
    expect(tools).toHaveLength(3);
    for (const tool of tools) {
      expect(tool.status).toBe("published");
      expect(tool.descriptionAr.length).toBeGreaterThan(40);
      expect(tool.pricingType).toBe("freemium");
      expect(tool.categoryId).not.toBeNull();
      expect(Number(tool.qualityScore)).toBeGreaterThanOrEqual(80);
      expect(tool.faqJson).toHaveLength(2);
      expect(tool.publishedAt).toBeInstanceOf(Date);
    }

    const tagLinks = await db.select().from(s.toolTags);
    const featureLinks = await db.select().from(s.toolFeatures);
    expect(tagLinks).toHaveLength(3);
    expect(featureLinks).toHaveLength(3);

    const logs = await db.select().from(s.aiProcessingLogs);
    expect(logs).toHaveLength(3);
    expect(logs.every((log) => log.validated && !log.failed)).toBe(true);

    const revisions = await db.select().from(s.contentRevisions);
    expect(revisions).toHaveLength(3);
    expect(revisions.every((revision) => revision.reason === "ai_create")).toBe(
      true,
    );
  });

  it("keeps malformed AI output out of the database and logs the failure", async () => {
    await seedCategory();
    const sourceId = await makeSource();
    const enrich = createEnricher({
      provider: scriptedProvider(["not json at all"]),
      database: db,
      minScore: 80,
      sleep: noSleep,
    });

    const result = await runSource({ sourceId, enrich });

    expect(result.metrics.created).toBe(3);
    expect(result.metrics.aiProcessed).toBe(0);
    expect(result.metrics.aiFailed).toBe(3);

    const tools = await db.select().from(s.tools);
    expect(tools.every((tool) => tool.status === "draft")).toBe(true);
    expect(tools.every((tool) => tool.descriptionAr === "")).toBe(true);

    const logs = await db.select().from(s.aiProcessingLogs);
    expect(logs).toHaveLength(3);
    expect(logs.every((log) => log.failed && !log.validated)).toBe(true);
  });

  it("holds back output with warnings (unknown URL) for review", async () => {
    await seedCategory();
    const sourceId = await makeSource();
    const enrichment = validEnrichment({
      descriptionAr:
        "أداة ذكاء اصطناعي ممتازة. تنزيل من https://evil.example.com/now للحصول على نسخة مجانية غير محدودة اليوم. ".repeat(
          2,
        ),
    });
    const enrich = createEnricher({
      provider: scriptedProvider([JSON.stringify(enrichment)]),
      database: db,
      minScore: 80,
      sleep: noSleep,
    });

    const result = await runSource({ sourceId, enrich });
    expect(result.metrics.aiProcessed).toBe(3);

    const tools = await db.select().from(s.tools);
    expect(tools.every((tool) => tool.status === "pending_review")).toBe(true);

    const logs = await db.select().from(s.aiProcessingLogs);
    expect(
      logs.every((log) => log.warnings.some((w) => w.includes("URLs"))),
    ).toBe(true);
  });

  it("surfaces permanent provider errors without retrying", async () => {
    await seedCategory();
    const sourceId = await makeSource();
    let calls = 0;
    const provider: AiProvider = {
      name: "perm",
      model: "perm-1",
      async generateJson() {
        calls += 1;
        throw new AiProviderError("bad request", false);
      },
    };
    const enrich = createEnricher({
      provider,
      database: db,
      minScore: 80,
      sleep: noSleep,
    });

    const result = await runSource({ sourceId, enrich });
    expect(result.metrics.aiFailed).toBe(3);
    expect(calls).toBe(3);
  });

  it("records the model and prompt version in the logs", async () => {
    await seedCategory();
    const sourceId = await makeSource();
    const enrich = createEnricher({
      provider: scriptedProvider([JSON.stringify(validEnrichment())]),
      database: db,
      minScore: 80,
      sleep: noSleep,
    });
    await runSource({ sourceId, enrich });

    const [log] = await db
      .select()
      .from(s.aiProcessingLogs)
      .where(eq(s.aiProcessingLogs.failed, false));
    expect(log.model).toBe("scripted-1");
    expect(log.promptVersion).toBe("enrich-v1");
  });
});
