import { describe, expect, it } from "vitest";
import { buildModelUpdateNotification } from "@/lib/notifications/messages";
import type { ModelRow, ProviderRow, ModelUpdateRow } from "@/lib/notifications/types";

const model = {
  id: "00000000-0000-0000-0000-0000000000a1",
  name: "Gamma Vision",
  slug: "deepnova-gamma-vision",
} as ModelRow;

const provider = { name: "DeepNova" } as ProviderRow;

function update(overrides: Partial<ModelUpdateRow> = {}): ModelUpdateRow {
  return {
    id: "00000000-0000-0000-0000-0000000000b1",
    kind: "new_version",
    title: "الإصدار الحالي: 2.0 → 3.0",
    contentAr: "أُضيفت معالجة الصور على الفور.",
    sourceUrl: "https://deepnova.example.com/changelog",
    ...overrides,
  } as ModelUpdateRow;
}

describe("buildModelUpdateNotification", () => {
  it("builds an Arabic-first message with model, provider and deep link", () => {
    const message = buildModelUpdateNotification({ model, provider, update: update() });
    expect(message.subject).toContain("إصدار جديد");
    expect(message.subject).toContain("Gamma Vision");
    expect(message.subject).toContain("DeepNova");
    expect(message.text).toContain("نموذج: Gamma Vision");
    expect(message.text).toContain("موفر: DeepNova");
    expect(message.text).toContain("/models/deepnova-gamma-vision");
    expect(message.text).toContain(update().sourceUrl);
  });

  it("uses a generic subject for non-version updates", () => {
    const message = buildModelUpdateNotification({
      model,
      provider,
      update: update({ kind: "context_window" }),
    });
    expect(message.subject).toContain("تحديث:");
    expect(message.subject).not.toContain("إصدار جديد");
  });

  it("handles unknown provider by omitting the provider segment", () => {
    const message = buildModelUpdateNotification({ model, provider: null, update: update() });
    expect(message.text).not.toContain("موفر:");
    expect(message.subject).not.toContain("(DeepNova)");
  });

  it("never embeds any credential or secret", () => {
    const message = buildModelUpdateNotification({ model, provider, update: update() });
    const serialized = JSON.stringify(message).toLowerCase();
    expect(serialized).not.toContain("token");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("apikey");
  });
});