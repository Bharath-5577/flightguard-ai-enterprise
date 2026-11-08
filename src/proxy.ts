import { NextRequest, NextResponse } from "next/server";

const BACKEND = "http://localhost:8000";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const isAdmin = pathname === "/admin" ||
    pathname.startsWith("/admin/");

  const isAirlineDashboard =
    pathname === "/airline/dashboard" ||
    pathname.startsWith("/airline/dashboard/");

  if (!isAdmin && !isAirlineDashboard) {
    return NextResponse.next();
  }

  // Login and registration pages must remain public.
  if (
    pathname === "/admin/login" ||
    pathname === "/airline/login" ||
    pathname === "/airline/register"
  ) {
    return NextResponse.next();
  }

  const loginPath = isAdmin
    ? "/admin/login"
    : "/airline/login";

  const redirectToLogin = () =>
    NextResponse.redirect(new URL(loginPath, request.url));

  const cookie = request.cookies.get("flightguard_session");

  if (!cookie?.value) {
    return redirectToLogin();
  }

  try {
    const endpoint = isAdmin
      ? "/api/auth/me"
      : "/api/airline/workspace";

    const response = await fetch(`${BACKEND}${endpoint}`, {
      method: "GET",
      headers: {
        Cookie: `flightguard_session=${cookie.value}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return redirectToLogin();
    }

    if (isAdmin) {
      const user = await response.json();

      if (!user.is_platform_admin) {
        return redirectToLogin();
      }
    }

    return NextResponse.next();
  } catch {
    return redirectToLogin();
  }
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/airline/dashboard/:path*",
  ],
};
