import { describe, it, expect } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security/headers";

describe("security headers", () => {
  it("applies the baseline hardening headers in every environment", () => {
    const headers = new Map(securityHeaders(false).map((h) => [h.key, h.value]));
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toContain("geolocation=()");
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(headers.get("Content-Security-Policy-Report-Only")).toBeTruthy();
  });

  it("only sends HSTS in production", () => {
    const dev = securityHeaders(false).map((h) => h.key);
    const prod = securityHeaders(true).map((h) => h.key);
    expect(dev).not.toContain("Strict-Transport-Security");
    expect(prod).toContain("Strict-Transport-Security");
  });

  it("restricts the policy to self plus Google ad origins", () => {
    const csp = contentSecurityPolicy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("pagead2.googlesyndication.com");
    expect(csp).toContain("frame-src 'self' https://googleads.g.doubleclick.net");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("*");
  });
});
