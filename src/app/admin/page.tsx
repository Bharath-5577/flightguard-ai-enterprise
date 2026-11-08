"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Overview = {
  status: string;
  organizations: number;
  active_organizations: number;
  airline_users: number;
  registrations: {
    pending: number;
    approved: number;
    rejected: number;
  };
  recent_activity: {
    action: string;
    created_at: string;
  }[];
};

export default function AdminDashboard() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const session = await fetch(`${API}/api/auth/me`, {
        credentials: "include",
        cache: "no-store",
      });

      if (!session.ok) {
        router.replace("/admin/login");
        return;
      }

      const user = await session.json();

      if (!user.is_platform_admin) {
        router.replace("/welcome");
        return;
      }

      const response = await fetch(
        `${API}/api/admin/registrations/overview`,
        {
          credentials: "include",
          cache: "no-store",
          headers: {
            Origin: window.location.origin,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Unable to load platform overview.");
      }

      setOverview(await response.json());

      try {
        const health = await fetch(`${API}/api/health`, {
          cache: "no-store",
        });
        setHealthy(health.ok);
      } catch {
        setHealthy(false);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Connection failed."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  async function signOut() {
    setSigningOut(true);
    setError("");

    try {
      const response = await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Unable to sign out.");
      }

      router.replace("/admin/login");
      router.refresh();
    } catch {
      setError("Unable to sign out. Please try again.");
      setSigningOut(false);
    }
  }

  const cards = overview
    ? [
        { label: "Organizations", value: overview.organizations },
        { label: "Active Organizations", value: overview.active_organizations },
        { label: "Airline Users", value: overview.airline_users },
        { label: "Pending Approvals", value: overview.registrations.pending },
        { label: "Approved Registrations", value: overview.registrations.approved },
        { label: "Rejected Registrations", value: overview.registrations.rejected },
      ]
    : [];

  return (
    <main className="min-h-screen bg-[#07152f] p-6 text-white md:p-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-widest text-sky-400">
              FLIGHTGUARD AI
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              FlightGuard Admin Control Center
            </h1>
            <p className="mt-2 text-slate-400">
              Platform administration and operational monitoring
            </p>
          </div>

          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="rounded-lg border border-slate-600 px-5 py-3 text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {signingOut ? "Signing Out..." : "Sign Out"}
          </button>
        </header>

        {error && (
          <p role="alert" className="mt-6 rounded-lg bg-red-900/30 p-4 text-red-300">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-700 bg-[#102344] p-5">
          <div>
            <h2 className="font-semibold">Platform Health</h2>
            <p className="mt-1 text-sm text-slate-300">
              {healthy === null
                ? "Checking backend..."
                : healthy
                  ? "Backend service is responding"
                  : "Backend service is unavailable"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadOverview()}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loading && (
          <p role="status" className="mt-8 text-slate-300">
            Loading platform statistics...
          </p>
        )}

        {overview && (
          <>
            <section className="mt-8 rounded-xl border border-sky-500/40 bg-[#102344] p-6">
              <h2 className="text-xl font-semibold">Aircraft Tracking Center</h2>
              <p className="mt-2 text-sm text-slate-300">
                View research aircraft observations or clearly labeled synthetic
                demonstrations. Not verified commercial flight status.
              </p>
              <Link
                href="/flights/live"
                className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500"
              >
                View Aircraft Tracking Center
              </Link>
            </section>

            <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border border-slate-700 bg-[#102344] p-6"
                >
                  <p className="text-sm text-slate-400">{card.label}</p>
                  <p className="mt-3 text-3xl font-bold">{card.value}</p>
                </div>
              ))}
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-700 bg-[#102344] p-6">
                <h2 className="text-xl font-semibold">Administration</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Review airline registrations and manage customer onboarding.
                </p>

                <Link
                  href="/admin/registrations"
                  className="mt-5 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500"
                >
                  Manage Registrations
                </Link>
              </div>

              <div className="rounded-xl border border-slate-700 bg-[#102344] p-6">
                <h2 className="text-xl font-semibold">Aviation Analytics</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Explore the shared historical aviation dataset and analytics.
                </p>

                <Link
                  href="/"
                  className="mt-5 inline-block rounded-lg border border-sky-500 px-5 py-3 font-semibold text-sky-300 hover:bg-sky-900/20"
                >
                  Open Flight Analytics
                </Link>
              </div>
            </section>

            <section className="mt-8 rounded-xl border border-slate-700 bg-[#102344] p-6">
              <h2 className="text-xl font-semibold">Recent Administrative Activity</h2>

              {overview.recent_activity.length === 0 ? (
                <p className="mt-4 text-slate-400">No activity recorded.</p>
              ) : (
                <div className="mt-5 space-y-3">
                  {overview.recent_activity.map((item, index) => (
                    <div
                      key={`${item.created_at}-${index}`}
                      className="flex flex-wrap justify-between gap-3 rounded-lg border border-white/10 bg-[#07152f] p-4"
                    >
                      <span className="text-sm font-medium">
                        {item.action.replaceAll("_", " ")}
                      </span>
                      <span className="text-xs text-slate-400">
                        {item.created_at}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        <p className="mt-10 text-center text-xs text-slate-500">
          FlightGuard AI — Enterprise Aviation Intelligence Platform
        </p>
      </div>
    </main>
  );
}
