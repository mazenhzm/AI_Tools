import Link from "next/link";
import type { PublicModelCard } from "@/lib/db/queries/models";

function formatPrice(value: string | null): string | null {
  if (value === null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number === 0) return "مجاني عند الاستخدام";
  return number.toLocaleString("en-US");
}

function formatContextWindow(value: number | null): string | null {
  if (value === null) return null;
  return value.toLocaleString("en-US");
}

export function ModelCard({ model }: { model: PublicModelCard }) {
  const inputPrice = formatPrice(model.inputPricePer1M);
  const openSource = model.isDownloadable;
  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/60 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug">
          <Link href={`/models/${model.slug}`} className="hover:underline">
            {model.name}
          </Link>
        </h3>
        {openSource ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            مفتوح المصدر
          </span>
        ) : null}
      </div>

      {model.descriptionAr ? (
        <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">
          {model.descriptionAr}
        </p>
      ) : model.providerName ? (
        <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">
          نموذج من {model.providerName}.
        </p>
      ) : (
        <p className="flex-1 text-sm text-muted-foreground">
          لا يوجد وصف بعد.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {model.providerSlug && model.providerName ? (
          <Link
            href={`/models?provider=${model.providerSlug}`}
            className="rounded-full bg-muted px-2 py-0.5 hover:underline"
          >
            {model.providerName}
          </Link>
        ) : null}
        {model.contextWindow ? (
          <span className="rounded-full border border-border px-2 py-0.5" title="نافذة السياق">
            {formatContextWindow(model.contextWindow)} رمز
          </span>
        ) : null}
        {inputPrice ? (
          <span className="rounded-full border border-border px-2 py-0.5" title="سعر الدخول لكل مليون رمز">
            {inputPrice} $/1M
          </span>
        ) : null}
      </div>
    </article>
  );
}

export function ModelGrid({ models }: { models: PublicModelCard[] }) {
  if (models.length === 0) {
    return (
      <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
        لا توجد نماذج مطابقة حالياً.
      </p>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {models.map((model) => (
        <ModelCard key={model.id} model={model} />
      ))}
    </div>
  );
}