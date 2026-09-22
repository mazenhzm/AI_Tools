import { modelFixtureAdapter } from "./adapter";
import { hfModelAdapter } from "../adapters/hf-models";
import type { ModelSourceAdapter } from "./types";

const MODEL_ADAPTERS: ModelSourceAdapter[] = [modelFixtureAdapter, hfModelAdapter];

const byKey = new Map(MODEL_ADAPTERS.map((adapter) => [adapter.key, adapter]));

export function listModelAdapters(): ModelSourceAdapter[] {
  return [...MODEL_ADAPTERS];
}

export function resolveModelAdapter(key: string | null | undefined): ModelSourceAdapter {
  const adapter = key ? byKey.get(key) : undefined;
  return adapter ?? modelFixtureAdapter;
}