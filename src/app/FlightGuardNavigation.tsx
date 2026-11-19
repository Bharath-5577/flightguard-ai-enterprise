"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Role = "visitor" | "airline" | "admin";

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const customerLinks = [
  { label: "Operations Intelligence", href: "/operations" },
  { label: "Dashboard", href: "/airline/dashboard" },
  { label: "Flights", href: "/airline/flights" },
  { label: "Predictions", href: "/airline/predictions" },
  { label: "Results", href: "/airline/results" },
  { label: "Reports", href: "/airline/reports" },
];

const adminLinks = [
  { label: "Operations Intelligence", href: "/operations" },
  { label: "Dashboard", href: "/admin" },
  { label: "Approvals", href: "/admin/registrations" },
  { label: "Airlines", href: "/admin/airlines" },
  { label: "Monitoring", href: "/admin/monitoring" },
];

export default function FlightGuardNavigation() {
  const pathname = usePathname() || "/";
  const router = useRouter();

  const [role, setRole] = useState<Role>("visitor");
  const [checking, setChecking] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      setChecking(true);

      try {
        const response = await fetch(`${API}/api/auth/me`, {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          if (active) setRole("visitor");
          return;
        }

        const user = await response.json();

        if (user.is_platform_admin) {
          if (active) setRole("admin");
          return;
        }

        const workspace = await fetch(
          `${API}/api/airline/workspace`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        if (active) {
          setRole(workspace.ok ? "airline" : "visitor");
        }
      } catch {
        if (active) setRole("visitor");
      } finally {
        if (active) setChecking(false);
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, [pathname]);

  async function signOut() {
    if (signingOut) return;

    setSigningOut(true);

    try {
      const response = await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Sign out failed");
      }

      setRole("visitor");
      router.replace("/");
      router.refresh();
    } catch {
      alert("Unable to sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  const links =
    role === "admin"
      ? adminLinks
      : role === "airline"
        ? customerLinks
        : [];

  return (
    <header className="sticky top-0 z-50 border-b border-sky-500/20 bg-[#07152f] text-white shadow-lg backdrop-blur">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-[#102344] px-4 py-2 text-xl font-extrabold tracking-wide !text-white"
        >
          ✈ FLIGHTGUARD <span className="text-sky-400">AI</span>
        </Link>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          {checking ? (
            <span className="text-slate-400">Checking session...</span>
          ) : role === "visitor" ? (
            <>
              <Link href="/" className="font-semibold !text-slate-100 hover:!text-sky-300">
                Home
              </Link>
              <Link href="/airline/login" className="font-semibold !text-slate-100 hover:!text-sky-300">
                Customer Login
              </Link>
              <Link href="/airline/register" className="font-semibold !text-slate-100 hover:!text-sky-300">
                Register Airline
              </Link>
              <Link href="/admin/login" className="font-semibold !text-slate-100 hover:!text-sky-300">
                Admin Login
              </Link>
            </>
          ) : (
            <>
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={
                    pathname === link.href ? "page" : undefined
                  }
                  className={
                    pathname === link.href
                      ? "font-semibold !text-cyan-300"
                      : "!text-slate-100 hover:!text-sky-300"
                  }
                >
                  {link.label}
                </Link>
              ))}

              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="rounded-lg border border-slate-600 px-3 py-2 font-semibold text-slate-200 hover:border-red-400 hover:text-red-300 disabled:opacity-50"
              >
                {signingOut ? "Signing out..." : "Sign Out"}
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
