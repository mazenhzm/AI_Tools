# AI PIPELINE

## Role

Gemini is an **enrichment and transformation engine** — the source record is the factual authority. Never the reverse.

## Flow

```
Ingestion Item (normalized, validated)
   │
   ▼
[AI Enrichment] structured prompt + responseSchema
   │  (name, decriptions AR/EN, features, category, pricing_type, SEO titles/meta, confidence, warnings)
   ▼
[Zod schema validation]  ← invalid → log & fail item (no store)
   ▼
[Fact validation]  pricing/category/features consistent with source; unknown → null
   ▼
[Confidence scoring]  fills partial gaps; low-confidence flags
   ▼
[Quality gate]  required fields, URLs valid, source exists, category valid, no unsupported claims
   ▼
pending_review  OR  publish (auto-publish only if quality threshold met)
```

## Anti-hallucination rules (enforced in system prompt AND independently validated)

- Never invent facts.
- Use only supplied source data or explicitly provided verified info.
- Do not infer pricing. Do not invent features/integrations/reviews/company info.
- Unavailable info → `unknown`/`null`.
- Clearly identify uncertain fields.
- No assumptions converted into facts.

## Structured JSON contract (Zod-validated)

```json
{
  "name": "...",
  "description_ar": "...",
  "description_en": "...",
  "features": [],
  "category": "...",
  "pricing_type": "free|freemium|paid|unknown",
  "seo_title_ar": "...",
  "seo_description_ar": "...",
  "seo_title_en": "...",
  "seo_description_en": "...",
  "confidence": 0.0,
  "warnings": []
}
```

Application-level independence: pricing_type default `unknown` unless source states it; features stored only when present in source; category must map to a real category else `pending_review`.

## Implementation

- `lib/ai/provider.ts` — `AIProvider` interface + Gemini impl (`@google/genai`, `responseSchema` JSON mode).
- `lib/ai/prompts.ts` — templates (enrichment, update-analysis, Arabic instruction rubric).
- `lib/ai/schemas.ts` — Zod schemas (aiResult, aiUpdateAnalysis).
- `lib/ai/quality.ts` — scoring + gate evaluation.
- `lib/ai/log.ts` — writes `ai_processing_logs`.
- Tests use a fake provider for valid/malformed/empty responses; live path skipped without `GEMINI_API_KEY`.