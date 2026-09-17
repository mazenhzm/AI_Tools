export interface SecurityHeader {
  key: string;
  value: string;
}

const ADSENSE_SCRIPT_SOURCES = [
  "https://pagead2.googlesyndication.com",
  "https://ep1.adtrafficquality.google",
  "https://partner.googleadservices.com",
  "https://securepubads.g.doubleclick.net",
  "https://tpc.googlesyndication.com",
  "https://www.googletagservices.com",
];

const ADSENSE_FRAME_SOURCES = [
  "https://googleads.g.doubleclick.net",
  "https://tpc.googlesyndication.com",
  "https://www.google.com",
  "https://ep2.adtrafficquality.google",
];

const ADSENSE_CONNECT_SOURCES = [
  "https://pagead2.googlesyndication.com",
  "https://googleads.g.doubleclick.net",
  "https://ep1.adtrafficquality.google",
  "https://fundingchoicesmessages.google.com",
];

/**
 * Content-Security-Policy for a Next.js App Router page that may serve AdSense.
 * `unsafe-inline` for scripts/styles is required by Next's streaming inline
 * bootstrap and by Google's ad tags; everything else is origin-restricted. It
 * is shipped as report-only until a nonce-based policy is wired in.
 */
export function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'unsafe-inline' ${ADSENSE_SCRIPT_SOURCES.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${ADSENSE_CONNECT_SOURCES.join(" ")}`,
    `frame-src 'self' ${ADSENSE_FRAME_SOURCES.join(" ")}`,
    "upgrade-insecure-requests",
  ].join("; ");
}

/**
 * Baseline hardening headers applied to every response. HSTS is only emitted
 * for production builds so local http development is unaffected.
 */
export function securityHeaders(isProduction: boolean): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    {
      key: "Content-Security-Policy-Report-Only",
      value: contentSecurityPolicy(),
    },
  ];

  if (isProduction) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}
