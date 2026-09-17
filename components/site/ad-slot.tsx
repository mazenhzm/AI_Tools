import Script from "next/script";
import { getAdSlot, type AdPlacement } from "@/lib/monetization/ads";

const PLACEMENT_LABEL: Record<AdPlacement, string> = {
  header: "إعلان",
  inContent: "إعلان",
  sidebar: "إعلان",
  listings: "إعلان",
};

/**
 * Env-driven AdSense slot. Renders nothing when `ADSENSE_CLIENT` or the slot
 * id for this placement is missing — no placeholder ads are ever invented.
 */
export function AdSlot({
  placement,
  className,
}: {
  placement: AdPlacement;
  className?: string;
}) {
  const config = getAdSlot(placement);
  if (!config) return null;

  return (
    <aside
      className={className}
      aria-label="مساحة إعلانية"
      data-ad-placement={placement}
    >
      <span className="text-[10px] text-muted-foreground">
        {PLACEMENT_LABEL[placement]}
      </span>
      <ins
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={config.client}
        data-ad-slot={config.slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
      <Script
        id={`adsense-loader-${placement}`}
        async
        strategy="afterInteractive"
        crossOrigin="anonymous"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.client}`}
      />
      <Script id={`adsense-push-${placement}`} strategy="afterInteractive">
        {`(adsbygoogle = window.adsbygoogle || []).push({});`}
      </Script>
    </aside>
  );
}
