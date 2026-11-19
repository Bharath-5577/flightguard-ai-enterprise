import { NextRequest, NextResponse } from "next/server";

const BACKEND = "http://127.0.0.1:8000";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const admin = pathname === "/admin" ||
    pathname.startsWith("/admin/");

  const airline = pathname === "/airline" ||
    pathname.startsWith("/airline/");

  const operations = pathname === "/operations" ||
    pathname.startsWith("/operations/");

  if (!admin && !airline && !operations) {
    return NextResponse.next();
  }

  const publicPages = new Set([
    "/admin/login",
    "/admin/register",
    "/airline/login",
    "/airline/register",
  ]);

  if (publicPages.has(pathname)) {
    return NextResponse.next();
  }

  const login = admin ? "/admin/login" : "/airline/login";

  const deny = () =>
    NextResponse.redirect(new URL(login, request.url));

  const token = request.cookies.get("flightguard_session")?.value;

  if (!token) return deny();

  const headers = {
    Cookie: `flightguard_session=${token}`,
  };

  try {
    const response = await fetch(`${BACKEND}/api/auth/me`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return deny();

    const user = await response.json();

    if (admin && !user.is_platform_admin) return deny();

    if (airline || (operations && !user.is_platform_admin)) {
      if (user.is_platform_admin) return deny();

      const workspace = await fetch(
        `${BACKEND}/api/airline/workspace`,
        {
          headers,
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!workspace.ok) return deny();
    }

    return NextResponse.next();
  } catch {
    return deny();
  }
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/airline/:path*",
    "/operations/:path*",
  ],
};
