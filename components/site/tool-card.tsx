import Link from "next/link";
import type { PublicToolCard } from "@/lib/db/queries/public";
import { pricingLabel } from "@/lib/ui/labels";

export function ToolCard({ tool }: { tool: PublicToolCard }) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/60 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug">
          <Link href={`/tools/${tool.slug}`} className="hover:underline">
            {tool.name}
          </Link>
        </h3>
        {tool.isFeatured ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            مميّزة
          </span>
        ) : null}
      </div>

      <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">
        {tool.shortDescriptionAr ?? "لا يوجد وصف مختصر بعد."}
      </p>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {tool.categorySlug && tool.categoryNameAr ? (
          <Link
            href={`/categories/${tool.categorySlug}`}
            className="rounded-full bg-muted px-2 py-0.5 hover:underline"
          >
            {tool.categoryNameAr}
          </Link>
        ) : null}
        <span className="rounded-full border border-border px-2 py-0.5">
          {pricingLabel(tool.pricingType)}
        </span>
      </div>
    </article>
  );
}

export function ToolGrid({ tools }: { tools: PublicToolCard[] }) {
  if (tools.length === 0) {
    return (
      <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
        لا توجد أدوات مطابقة حالياً.
      </p>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}
