import { env } from "@/lib/env";

export type AdPlacement = "header" | "inContent" | "sidebar" | "listings";

export interface AdSlotConfig {
  client: string;
  slot: string;
}

export interface AdConfig {
  client: string;
  slots: Record<AdPlacement, string>;
}

export const AD_PLACEMENTS: AdPlacement[] = [
  "header",
  "inContent",
  "sidebar",
  "listings",
];

/**
 * Resolve the ad unit for a placement. Returns null when ads are not
 * configured, so pages render without empty/fake ad containers.
 */
export function resolveAdSlot(
  placement: AdPlacement,
  config: AdConfig,
): AdSlotConfig | null {
  const client = config.client.trim();
  const slot = config.slots[placement]?.trim();
  if (!client || !slot) return null;
  return { client, slot };
}

export function adConfigFromEnv(): AdConfig {
  return { client: env.adsenseClient, slots: env.adsenseSlots };
}

export function getAdSlot(placement: AdPlacement): AdSlotConfig | null {
  return resolveAdSlot(placement, adConfigFromEnv());
}
