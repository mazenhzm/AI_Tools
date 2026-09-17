import { describe, it, expect } from "vitest";
import { formatDurationMs, metricNumber } from "@/lib/ui/labels";

describe("metricNumber", () => {
  it("reads numbers and numeric strings from jsonb metrics", () => {
    expect(metricNumber({ fetched: 12 }, "fetched")).toBe(12);
    expect(metricNumber({ fetched: "7" }, "fetched")).toBe(7);
  });

  it("returns 0 for missing, null or non-numeric values", () => {
    expect(metricNumber({}, "created")).toBe(0);
    expect(metricNumber(null, "created")).toBe(0);
    expect(metricNumber(undefined, "created")).toBe(0);
    expect(metricNumber({ created: "n/a" }, "created")).toBe(0);
  });
});

describe("formatDurationMs", () => {
  it("formats sub-second, second and minute durations", () => {
    expect(formatDurationMs(340)).toBe("340ms");
    expect(formatDurationMs(1500)).toBe("1.5s");
    expect(formatDurationMs(125_000)).toBe("2m 5s");
  });

  it("renders a placeholder for missing durations", () => {
    expect(formatDurationMs(0)).toBe("—");
    expect(formatDurationMs(Number.NaN)).toBe("—");
  });
});
