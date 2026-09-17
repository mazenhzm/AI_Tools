import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/db";
import { db as defaultDb } from "@/lib/db/db";
import * as s from "@/lib/db/schema";
import { env } from "@/lib/env";
import type { EnrichFn } from "@/ingestion/pipeline";
import { slugify } from "@/lib/utils/text";
import { checkEnrichmentFacts } from "./fact-check";
import { parseJsonFromModel } from "./json";
import { buildEnrichmentPrompt } from "./prompts";
import {
  createGeminiProvider,
  withRetry,
  type AiProvider,
  type GenerateJsonResult,
} from "./provider";
import { decidePublication, scoreEnrichment } from "./quality";
import {
  AI_PROMPT_VERSION,
  validateAiEnrichment,
  type AiEnrichment,
} from "./schemas";

export interface EnricherDeps {
  provider: AiProvider;
  database?: Db;
  minScore?: number;
  promptVersion?: string;
  attempts?: number;
  /** Injected for tests so retries do not actually sleep. */
  sleep?: (ms: number) => Promise<void>;
}

interface CategoryRef {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
}

interface PersistArgs {
  database: Db;
  toolId: string;
  ingestionItemId: string | null;
  enrichment: AiEnrichment;
  warnings: string[];
  categoryId: string | null;
  score: number;
  status: "published" | "pending_review";
  promptVersion: string;
  generated: GenerateJsonResult;
}

function faqToJson(
  enrichment: AiEnrichment,
): Array<Record<string, string>> {
  return enrichment.faq.map((faq) => {
    const entry: Record<string, string> = {
      questionAr: faq.questionAr,
      answerAr: faq.answerAr,
    };
    if (faq.questionEn) entry.questionEn = faq.questionEn;
    if (faq.answerEn) entry.answerEn = faq.answerEn;
    return entry;
  });
}

async function persistSuccess(args: PersistArgs): Promise<void> {
  const {
    database,
    toolId,
    ingestionItemId,
    enrichment,
    warnings,
    categoryId,
    score,
    status,
    promptVersion,
    generated,
  } = args;

  await database.transaction(async (tx) => {
    await tx
      .update(s.tools)
      .set({
        descriptionAr: enrichment.descriptionAr,
        descriptionEn: enrichment.descriptionEn,
        shortDescriptionAr: enrichment.shortDescriptionAr,
        shortDescriptionEn: enrichment.shortDescriptionEn,
        longDescriptionAr: enrichment.longDescriptionAr ?? null,
        longDescriptionEn: enrichment.longDescriptionEn ?? null,
        pricingType: enrichment.pricingType,
        pricingNotes: enrichment.pricingNotes,
        seoTitleAr: enrichment.seoTitleAr,
        seoDescriptionAr: enrichment.seoDescriptionAr,
        seoTitleEn: enrichment.seoTitleEn,
        seoDescriptionEn: enrichment.seoDescriptionEn,
        faqJson: faqToJson(enrichment),
        categoryId,
        qualityScore: score.toFixed(2),
        status,
        publishedAt: status === "published" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(s.tools.id, toolId));

    for (const raw of enrichment.tags) {
      const slug = slugify(raw);
      if (!slug) continue;
      const [tag] = await tx
        .insert(s.tags)
        .values({ name: raw.trim(), slug })
        .onConflictDoNothing()
        .returning();
      const tagId =
        tag?.id ??
        (
          await tx
            .select({ id: s.tags.id })
            .from(s.tags)
            .where(eq(s.tags.slug, slug))
            .limit(1)
        )[0]?.id;
      if (tagId) {
        await tx
          .insert(s.toolTags)
          .values({ toolId, tagId })
          .onConflictDoNothing();
      }
    }

    for (const raw of enrichment.features) {
      const key = slugify(raw);
      if (!key) continue;
      const [feature] = await tx
        .insert(s.features)
        .values({ nameAr: raw.trim(), nameEn: raw.trim(), normalizedKey: key })
        .onConflictDoNothing()
        .returning();
      const featureId =
        feature?.id ??
        (
          await tx
            .select({ id: s.features.id })
            .from(s.features)
            .where(eq(s.features.normalizedKey, key))
            .limit(1)
        )[0]?.id;
      if (featureId) {
        await tx
          .insert(s.toolFeatures)
          .values({ toolId, featureId })
          .onConflictDoNothing();
      }
    }

    await tx.insert(s.contentRevisions).values({
      entityType: "tool",
      entityId: toolId,
      field: "ai_enrichment",
      before: null,
      after: {
        status,
        qualityScore: score,
        categoryId,
        descriptionAr: enrichment.descriptionAr,
      },
      reason: "ai_create",
    });

    await tx.insert(s.aiProcessingLogs).values({
      toolId,
      ingestionItemId,
      kind: "enrich",
      model: generated.model,
      promptVersion,
      inputTokens: generated.inputTokens ?? null,
      outputTokens: generated.outputTokens ?? null,
      confidence: enrichment.confidence.toFixed(2),
      warnings,
      validated: true,
      failed: false,
      rawResponse: generated.raw ?? { text: generated.text },
    });
  });
}

async function logFailure(args: {
  database: Db;
  toolId: string;
  ingestionItemId: string | null;
  provider: AiProvider;
  promptVersion: string;
  error: string;
  model?: string | null;
  raw?: unknown;
  warnings?: string[];
}): Promise<void> {
  await args.database.insert(s.aiProcessingLogs).values({
    toolId: args.toolId,
    ingestionItemId: args.ingestionItemId,
    kind: "enrich",
    model: args.model ?? args.provider.model,
    promptVersion: args.promptVersion,
    warnings: args.warnings ?? [],
    validated: false,
    failed: true,
    error: args.error,
    rawResponse: args.raw ?? null,
  });
}

/**
 * Builds the AI enrichment hook used by the ingestion pipeline. Only tools that
 * were just created are enriched. Every path records an `ai_processing_logs`
 * row and returns a structured result instead of throwing.
 */
export function createEnricher(deps: EnricherDeps): EnrichFn {
  const database = deps.database ?? defaultDb;
  const minScore = deps.minScore ?? env.autoPublishMinScore;
  const promptVersion = deps.promptVersion ?? AI_PROMPT_VERSION;

  return async ({ toolId, item, ingestionItemId }) => {
    const [tool] = await database
      .select()
      .from(s.tools)
      .where(eq(s.tools.id, toolId))
      .limit(1);
    if (!tool) return { ok: false, error: `tool not found: ${toolId}` };

    const categoryRows: CategoryRef[] = await database
      .select({
        id: s.categories.id,
        slug: s.categories.slug,
        nameAr: s.categories.nameAr,
        nameEn: s.categories.nameEn,
      })
      .from(s.categories);
    const tagRows = await database
      .select({ slug: s.tags.slug, name: s.tags.name })
      .from(s.tags);
    const featureRows = await database
      .select({
        key: s.features.normalizedKey,
        nameAr: s.features.nameAr,
        nameEn: s.features.nameEn,
      })
      .from(s.features);

    const built = buildEnrichmentPrompt({
      item,
      categories: categoryRows,
      tags: tagRows.map((tag) => ({
        slug: tag.slug,
        nameAr: tag.name,
        nameEn: tag.name,
      })),
      features: featureRows.map((feature) => ({
        slug: feature.key,
        nameAr: feature.nameAr,
        nameEn: feature.nameEn,
      })),
    });

    let generated: GenerateJsonResult;
    try {
      generated = await withRetry(
        () =>
          deps.provider.generateJson({
            system: built.system,
            prompt: built.prompt,
          }),
        {
          attempts: deps.attempts ?? 3,
          baseDelayMs: 400,
          sleep: deps.sleep,
          onRetry: (attempt, err, delay) => {
            console.warn(
              `[ai] retrying provider (attempt ${attempt}) in ${delay}ms: ${(err as Error).message}`,
            );
          },
        },
      );
    } catch (err) {
      const message = (err as Error)?.message ?? "provider failure";
      await logFailure({
        database,
        toolId,
        ingestionItemId,
        provider: deps.provider,
        promptVersion,
        error: message,
      });
      return { ok: false, error: message };
    }

    const json = parseJsonFromModel(generated.text);
    if (!json.ok) {
      await logFailure({
        database,
        toolId,
        ingestionItemId,
        provider: deps.provider,
        promptVersion,
        error: json.error,
        model: generated.model,
        raw: generated.raw ?? { text: generated.text },
      });
      return { ok: false, error: json.error };
    }

    const validated = validateAiEnrichment(json.value);
    if (!validated.ok || !validated.data) {
      const error = validated.error ?? "AI output failed validation";
      await logFailure({
        database,
        toolId,
        ingestionItemId,
        provider: deps.provider,
        promptVersion,
        error,
        model: generated.model,
        raw: generated.raw ?? { text: generated.text },
      });
      return { ok: false, error };
    }

    const enrichment = validated.data;
    const factCheck = checkEnrichmentFacts(enrichment, {
      item,
      allowedCategorySlugs: categoryRows.map((category) => category.slug),
    });
    const warnings = [...enrichment.warnings, ...factCheck.warnings];
    const quality = scoreEnrichment(enrichment, factCheck.warnings);
    const decision = decidePublication({
      score: quality.score,
      confidence: enrichment.confidence,
      warnings,
      minScore,
    });

    const matchedCategory = categoryRows.find(
      (category) => category.slug === enrichment.categorySlug,
    );

    await persistSuccess({
      database,
      toolId,
      ingestionItemId,
      enrichment,
      warnings,
      categoryId: matchedCategory?.id ?? null,
      score: decision.score,
      status: decision.status,
      promptVersion,
      generated,
    });

    return { ok: true };
  };
}

/**
 * Returns the live provider when a Gemini API key is configured, otherwise null.
 */
export function createProviderFromEnv(): AiProvider | null {
  if (!env.geminiApiKey) return null;
  return createGeminiProvider({
    apiKey: env.geminiApiKey,
    model: env.geminiModel,
    timeoutMs: env.geminiTimeoutMs,
  });
}

/**
 * Returns an enricher when a Gemini API key is configured, otherwise null so the
 * worker runs ingestion-only and clearly reports AI as disabled.
 */
export function createEnricherFromEnv(
  overrides: Partial<Pick<EnricherDeps, "database" | "minScore">> = {},
): EnrichFn | null {
  const provider = createProviderFromEnv();
  if (!provider) return null;
  return createEnricher({ provider, ...overrides });
}
