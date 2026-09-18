import Link from "next/link";
import { notFound } from "next/navigation";
import { unsubscribeByToken } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export default async function UnsubscribeAlertPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) notFound();

  const result = await unsubscribeByToken(token);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-start gap-4 rounded-2xl border border-border p-6">
      <h1 className="text-xl font-bold">إلغاء اشتراك إشعارات التغيير</h1>
      {result.ok ? (
        <>
          <p className="text-sm text-muted-foreground">
            تم إلغاء اشتراكك. لن تصلك إشعارات تغيير أخرى لهذا الهدف.
          </p>
          <Link
            href="/models"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            تصفح النماذج
          </Link>
        </>
      ) : (
        <p className="text-sm text-rose-600">
          {result.error ?? "تعذر إلغاء هذا الاشتراك."}
        </p>
      )}
    </div>
  );
}