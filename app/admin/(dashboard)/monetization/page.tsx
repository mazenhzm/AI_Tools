import {
  saveSponsoredAction,
  setSponsoredStatusAction,
} from "@/lib/actions/monetization";
import { listSponsoredListings } from "@/lib/db/queries/catalog";
import { listToolsForAdmin } from "@/lib/db/queries/admin";
import {
  CAMPAIGN_STATUS_VALUES,
  campaignStatusLabel,
} from "@/lib/ui/labels";

export default async function AdminMonetizationPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const [listings, tools] = await Promise.all([
    listSponsoredListings(),
    listToolsForAdmin({ pageSize: 100 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">التمويل ({listings.length})</h1>

      {message ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          {message}
        </p>
      ) : null}

      <section className="rounded-xl border border-border p-4">
        <h2 className="mb-3 font-semibold">حملة مدفوعة جديدة</h2>
        <form
          action={saveSponsoredAction}
          className="grid gap-2 md:grid-cols-2"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span>الأداة</span>
            <select
              name="toolId"
              required
              defaultValue=""
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="" disabled>
                اختر أداة
              </option>
              {tools.items.map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>الموضع</span>
            <select
              name="placement"
              defaultValue="featured"
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="featured">مميّزة</option>
              <option value="header">أعلى الصفحة</option>
              <option value="listing">قائمة الأدوات</option>
              <option value="sidebar">الشريط الجانبي</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>تاريخ البدء</span>
            <input
              name="startDate"
              type="date"
              required
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>تاريخ الانتهاء</span>
            <input
              name="endDate"
              type="date"
              required
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>حالة الحملة</span>
            <select
              name="campaignStatus"
              defaultValue="draft"
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              {CAMPAIGN_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {campaignStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>مرجع خارجي (اختياري)</span>
            <input
              name="externalReference"
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground md:col-span-2"
          >
            حفظ الحملة
          </button>
        </form>
      </section>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-start">الأداة</th>
              <th className="p-3 text-start">الموضع</th>
              <th className="p-3 text-start">الفترة</th>
              <th className="p-3 text-start">الحالة</th>
              <th className="p-3 text-start">تغيير الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {listings.map((listing) => (
              <tr key={listing.id}>
                <td className="p-3">{listing.toolName ?? "—"}</td>
                <td className="p-3">{listing.placement}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {listing.startDate} → {listing.endDate}
                </td>
                <td className="p-3">
                  {campaignStatusLabel(listing.campaignStatus)}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {CAMPAIGN_STATUS_VALUES.map((status) => (
                      <form key={status} action={setSponsoredStatusAction}>
                        <input
                          type="hidden"
                          name="listingId"
                          value={listing.id}
                        />
                        <input type="hidden" name="campaignStatus" value={status} />
                        <button
                          type="submit"
                          disabled={status === listing.campaignStatus}
                          className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
                        >
                          {campaignStatusLabel(status)}
                        </button>
                      </form>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {listings.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="p-6 text-center text-muted-foreground"
                >
                  لا توجد حملات.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
