import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

/**
 * Optimistic guard only. It checks for the presence of an Auth.js session
 * cookie and redirects anonymous visitors away from /admin. Real authorization
 * happens in the admin layout and in every server action via `auth()` +
 * `requireActor()` — a forged cookie cannot perform any privileged write.
 */
export function proxy(request: NextRequest) {
  const { pathname, origin, search } = request.nextUrl;
  const isLogin = pathname === "/admin/login";
  const hasSession = SESSION_COOKIES.some((name) =>
    request.cookies.has(name),
  );

  if (!hasSession && !isLogin) {
    const url = new URL("/admin/login", origin);
    url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (hasSession && isLogin) {
    return NextResponse.redirect(new URL("/admin", origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
