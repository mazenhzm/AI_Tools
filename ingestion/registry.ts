import { fixtureAdapter } from "./adapters/fixture";
import { rssAdapter } from "./adapters/rss";
import type { SourceAdapter } from "./types";

const ADAPTERS: SourceAdapter[] = [rssAdapter, fixtureAdapter];

const byKey = new Map(ADAPTERS.map((adapter) => [adapter.key, adapter]));

export function listAdapters(): SourceAdapter[] {
  return [...ADAPTERS];
}

export function resolveAdapter(key: string | null | undefined): SourceAdapter {
  const adapter = key ? byKey.get(key) : undefined;
  return adapter ?? rssAdapter;
}

export function registerAdapter(adapter: SourceAdapter): void {
  ADAPTERS.push(adapter);
  byKey.set(adapter.key, adapter);
}
