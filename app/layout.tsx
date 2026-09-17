import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { env } from "@/lib/env";
import {
  SITE_DESCRIPTION_AR,
  SITE_KEYWORDS_AR,
  SITE_NAME_AR,
  SITE_NAME_EN,
  siteOrigin,
} from "@/lib/seo/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: `${SITE_NAME_AR} — دليل واكتشاف`,
    template: `%s | ${SITE_NAME_AR}`,
  },
  description: SITE_DESCRIPTION_AR,
  applicationName: SITE_NAME_AR,
  keywords: SITE_KEYWORDS_AR,
  authors: [{ name: SITE_NAME_AR }],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME_AR,
    title: SITE_NAME_AR,
    description: SITE_DESCRIPTION_AR,
    locale: "ar_AR",
    url: "/",
  },
  twitter: { card: "summary_large_image" },
  appleWebApp: { title: SITE_NAME_EN },
  verification: env.googleSiteVerification
    ? { google: env.googleSiteVerification }
    : undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
  themeColor: "#0b0e14",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
