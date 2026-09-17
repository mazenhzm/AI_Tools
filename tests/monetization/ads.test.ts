import { describe, it, expect } from "vitest";
import { AD_PLACEMENTS, resolveAdSlot, type AdConfig } from "@/lib/monetization/ads";

const base: AdConfig = {
  client: "ca-pub-1234567890",
  slots: { header: "1", inContent: "2", sidebar: "3", listings: "4" },
};

describe("resolveAdSlot", () => {
  it("returns null when no client is configured", () => {
    expect(resolveAdSlot("header", { ...base, client: "" })).toBeNull();
  });

  it("returns null when the placement slot is missing", () => {
    expect(
      resolveAdSlot("sidebar", {
        ...base,
        slots: { ...base.slots, sidebar: "" },
      }),
    ).toBeNull();
  });

  it("returns the client and slot when both are configured", () => {
    expect(resolveAdSlot("listings", base)).toEqual({
      client: "ca-pub-1234567890",
      slot: "4",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(
      resolveAdSlot("inContent", {
        client: "  ca-pub-1  ",
        slots: { ...base.slots, inContent: " 9 " },
      }),
    ).toEqual({ client: "ca-pub-1", slot: "9" });
  });

  it("defines a slot name for every placement", () => {
    for (const placement of AD_PLACEMENTS) {
      expect(base.slots[placement]).toBeTruthy();
    }
  });
});
