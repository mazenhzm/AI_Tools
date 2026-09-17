import Link from "next/link";

export function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function href(target: number): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    if (target > 1) query.set("page", String(target));
    const suffix = query.toString();
    return suffix ? `${basePath}?${suffix}` : basePath;
  }

  return (
    <nav className="flex items-center justify-between text-sm" aria-label="ترقيم الصفحات">
      <span className="text-muted-foreground">
        صفحة {page} من {totalPages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={href(page - 1)}
            rel="prev"
            className="rounded-md border border-border px-3 py-1 hover:bg-muted"
          >
            السابق
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            href={href(page + 1)}
            rel="next"
            className="rounded-md border border-border px-3 py-1 hover:bg-muted"
          >
            التالي
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
