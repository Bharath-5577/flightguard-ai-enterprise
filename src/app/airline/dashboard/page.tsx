"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PrivateOperations from "./PrivateOperations";

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Organization = {
  organization_id: string;
  name: string;
  role: string;
};

type SessionUser = {
  email: string;
  is_platform_admin: boolean;
  organizations: Organization[];
};


type FlightMetric = {
  total_flights: number;
  delayed_flights: number;
  delay_rate_percent: number;
};

type HistoricalAnalytics = {
  status: string;
  data_scope: string;
  source: string;
  organization_specific: boolean;
  summary: FlightMetric & { origin_airports: number };
  airlines: (FlightMetric & { airline: string })[];
  airports: (FlightMetric & { airport: string })[];
  routes: (FlightMetric & {
    origin: string;
    destination: string;
  })[];
  daily: (FlightMetric & { date: string })[];
};

type FilteredPerformance = FlightMetric & {
  status: string;
  data_scope: string;
  organization_specific: boolean;
  filters: {
    airline: string | null;
    origin: string | null;
    destination: string | null;
  };
  available_destinations: string[];
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);

export default function AirlineDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analytics, setAnalytics] =
    useState<HistoricalAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [selectedAirline, setSelectedAirline] = useState("");
  const [selectedAirport, setSelectedAirport] = useState("");
  const [selectedDestination, setSelectedDestination] = useState("");
  const [availableDestinations, setAvailableDestinations] =
    useState<string[]>([]);
  const [combinedPerformance, setCombinedPerformance] =
    useState<FilteredPerformance | null>(null);
  const [combinedLoading, setCombinedLoading] = useState(false);
  const [combinedError, setCombinedError] = useState("");


  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await fetch(`${API}/api/airline/workspace`, {
          credentials: "include",
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace("/airline/login");
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to verify your session.");
        }

        const account: SessionUser = await response.json();

        if (
          account.is_platform_admin ||
          !account.organizations?.length
        ) {
          router.replace("/airline/login");
          return;
        }

        if (active) setUser(account);

        try {
          const analyticsResponse = await fetch(
            `${API}/api/airline/historical-analytics`,
            { credentials: "include", cache: "no-store" }
          );

          if (!analyticsResponse.ok) {
            throw new Error("Analytics request failed.");
          }

          const result: HistoricalAnalytics =
            await analyticsResponse.json();

          if (result.data_scope !== "shared_historical") {
            throw new Error("Unexpected analytics data scope.");
          }

          if (active) setAnalytics(result);
        } catch {
          if (active) {
            setAnalyticsError(
              "Historical analytics are temporarily unavailable."
            );
          }
        }

      } catch {
        if (active) {
          setError("Unable to connect to the authentication service.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!user || !analytics) return;

    const controller = new AbortController();
    let active = true;

    async function loadCombinedPerformance() {
      setCombinedLoading(true);
      setCombinedError("");

      const params = new URLSearchParams();
      if (selectedAirline) params.set("airline", selectedAirline);
      if (selectedAirport) params.set("origin", selectedAirport);
      if (selectedDestination) params.set("destination", selectedDestination);

      try {
        const response = await fetch(
          `${API}/api/airline/filtered-performance?${params.toString()}`,
          {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (response.status === 401) {
          router.replace("/airline/login");
          return;
        }

        if (!response.ok) {
          throw new Error("Filtered performance request failed.");
        }

        const result: FilteredPerformance = await response.json();

        if (
          result.data_scope !== "shared_historical" ||
          result.organization_specific !== false
        ) {
          throw new Error("Unexpected filtered data scope.");
        }

        if (active) {
          setCombinedPerformance(result);
          setAvailableDestinations(result.available_destinations);
        }
      } catch (error) {
        if (active && !controller.signal.aborted) {
          setCombinedError("Unable to load combined flight performance.");
        }
      } finally {
        if (active) setCombinedLoading(false);
      }
    }

    loadCombinedPerformance();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    user,
    analytics,
    selectedAirline,
    selectedAirport,
    selectedDestination,
    router,
  ]);

  async function signOut() {
    try {
      const response = await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Sign out failed.");
      }

      router.replace("/airline/login");
      router.refresh();
    } catch {
      setError("Unable to sign out. Please try again.");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07152f] text-white">
        Verifying your account...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07152f] p-6 text-white">
        <p role="alert">{error || "Redirecting to login..."}</p>
      </main>
    );
  }

  const organization = user.organizations[0];

  return (
    <main className="min-h-screen bg-[#07152f] text-white">
      <header className="border-b border-white/10 bg-[#102344] px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">FlightGuard AI</h1>
            <p className="text-sm text-slate-300">
              Airline Operations Workspace
            </p>
          </div>

          <button
            onClick={signOut}
            className="rounded-lg border border-white/20 px-5 py-2 text-sm hover:bg-white/10"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <section>
          <p className="text-sm font-medium text-sky-400">
            CUSTOMER WORKSPACE
          </p>

          <h2 className="mt-2 text-3xl font-bold">
            Welcome to {organization.name}
          </h2>

          <p className="mt-3 text-slate-300">
            Signed in as {user.email}
          </p>
        </section>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#102344] p-6">
            <p className="text-sm text-slate-300">Account Status</p>
            <p className="mt-3 text-xl font-semibold text-emerald-400">
              Active
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#102344] p-6">
            <p className="text-sm text-slate-300">Organization</p>
            <p className="mt-3 text-xl font-semibold">
              {organization.name}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#102344] p-6">
            <p className="text-sm text-slate-300">Your Role</p>
            <p className="mt-3 text-xl font-semibold">
              {organization.role === "org_admin"
                ? "Organization Administrator"
                : "Analyst"}
            </p>
          </div>
        </div>

        <section className="rounded-xl border border-white/10 bg-[#102344] p-7">
          <h3 className="text-xl font-semibold">
            Aviation Intelligence
          </h3>

          <p className="mt-3 max-w-3xl text-slate-300">
            FlightGuard AI provides historical aviation intelligence
            and operational analytics. Organization-specific data
            access will be enabled only after the appropriate
            verification and authorization controls are implemented.
          </p>
        </section>


        <section className="rounded-xl border border-sky-500/40 bg-[#102344] p-6">
          <h3 className="text-xl font-semibold">Aircraft Tracking Center</h3>
          <p className="mt-2 text-sm text-slate-300">
            Explore observed aircraft positions from authorized research sources,
            or use clearly labeled synthetic aircraft for interface testing.
            This is not a certified flight-dispatch system.
          </p>
          <a
            href="/flights/live"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500"
          >
            View Aircraft Tracking Center
          </a>
        </section>

                <PrivateOperations />

        <section className="space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-sky-400">
              Shared Historical Aviation Data
            </p>
            <h3 className="mt-2 text-2xl font-bold">
              Aviation Performance Overview
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              Historical BTS network data, January–March 2015.
              These records are not specific to your organization
              and do not represent live operations.
            </p>
          </div>

          {analyticsError && (
            <p role="alert" className="text-red-300">
              {analyticsError}
            </p>
          )}

          {!analytics && !analyticsError && (
            <p className="text-slate-300">
              Loading historical aviation analytics...
            </p>
          )}

          {analytics && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: "Total Flights",
                    value: formatNumber(analytics.summary.total_flights),
                  },
                  {
                    label: "Delayed Flights",
                    value: formatNumber(analytics.summary.delayed_flights),
                  },
                  {
                    label: "Delay Rate",
                    value: `${analytics.summary.delay_rate_percent}%`,
                  },
                  {
                    label: "Origin Airports",
                    value: formatNumber(analytics.summary.origin_airports),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/10 bg-[#102344] p-6"
                  >
                    <p className="text-sm text-slate-300">
                      {item.label}
                    </p>
                    <p className="mt-3 text-3xl font-bold">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>


              <section className="rounded-xl border border-white/10 bg-[#102344] p-6">
                <h4 className="text-lg font-semibold">
                  Selected Airline Performance
                </h4>
                <p className="mt-2 text-sm text-slate-300">
                  Explore airline-level statistics from the shared
                  historical BTS dataset. These are not live or
                  organization-specific operational metrics.
                </p>

                <div className="mt-5">
                  <label
                    htmlFor="historical-airline"
                    className="mb-2 block text-sm font-medium text-slate-200"
                  >
                    Select Airline
                  </label>
                  <select
                    id="historical-airline"
                    value={selectedAirline}
                    onChange={(event) => {
                      setSelectedAirline(event.target.value);
                      setSelectedDestination("");
                      setAvailableDestinations([]);
                    }}
                    className="w-full max-w-sm rounded-lg border border-white/20 bg-[#07152f] px-4 py-3 text-white"
                  >
                    <option value="">Choose an airline</option>
                    {analytics.airlines.map((airline) => (
                      <option
                        key={airline.airline}
                        value={airline.airline}
                      >
                        {airline.airline}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedAirline &&
                  analytics.airlines
                    .filter((item) => item.airline === selectedAirline)
                    .map((item) => (
                      <div
                        key={item.airline}
                        className="mt-6 grid gap-4 sm:grid-cols-3"
                      >
                        {[
                          {
                            label: "Total Flights",
                            value: formatNumber(item.total_flights),
                          },
                          {
                            label: "Delayed Flights",
                            value: formatNumber(item.delayed_flights),
                          },
                          {
                            label: "Delay Rate",
                            value: `${item.delay_rate_percent}%`,
                          },
                        ].map((metric) => (
                          <div
                            key={metric.label}
                            className="rounded-lg border border-white/10 bg-[#07152f] p-5"
                          >
                            <p className="text-sm text-slate-300">
                              {metric.label}
                            </p>
                            <p className="mt-2 text-2xl font-bold">
                              {metric.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    ))}
              </section>


              <section className="rounded-xl border border-white/10 bg-[#102344] p-6">
                <h4 className="text-lg font-semibold">
                  Selected Airport Performance
                </h4>
                <p className="mt-2 text-sm text-slate-300">
                  Explore origin airport statistics from the shared
                  historical BTS network dataset. Airport statistics
                  represent all airlines in the dataset.
                </p>

                <div className="mt-5">
                  <label
                    htmlFor="historical-airport"
                    className="mb-2 block text-sm font-medium text-slate-200"
                  >
                    Select Origin Airport
                  </label>
                  <select
                    id="historical-airport"
                    value={selectedAirport}
                    onChange={(event) => {
                      setSelectedAirport(event.target.value);
                      setSelectedDestination("");
                      setAvailableDestinations([]);
                    }}
                    className="w-full max-w-sm rounded-lg border border-white/20 bg-[#07152f] px-4 py-3 text-white"
                  >
                    <option value="">Choose an airport</option>
                    {analytics.airports.map((airport) => (
                      <option
                        key={airport.airport}
                        value={airport.airport}
                      >
                        {airport.airport}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedAirport &&
                  analytics.airports
                    .filter((item) => item.airport === selectedAirport)
                    .map((item) => (
                      <div
                        key={item.airport}
                        className="mt-6 grid gap-4 sm:grid-cols-3"
                      >
                        {[
                          {
                            label: "Total Departures",
                            value: formatNumber(item.total_flights),
                          },
                          {
                            label: "Delayed Departures",
                            value: formatNumber(item.delayed_flights),
                          },
                          {
                            label: "Delay Rate",
                            value: `${item.delay_rate_percent}%`,
                          },
                        ].map((metric) => (
                          <div
                            key={metric.label}
                            className="rounded-lg border border-white/10 bg-[#07152f] p-5"
                          >
                            <p className="text-sm text-slate-300">
                              {metric.label}
                            </p>
                            <p className="mt-2 text-2xl font-bold">
                              {metric.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    ))}
              </section>

              <section className="rounded-xl border border-sky-400/30 bg-[#102344] p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold">
                      Combined Flight Performance
                    </h4>
                    <p className="mt-2 text-sm text-slate-300">
                      Airline, origin, and destination filters are applied
                      together to shared historical BTS records, not live operations.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAirline("");
                      setSelectedAirport("");
                      setSelectedDestination("");
                      setAvailableDestinations([]);
                    }}
                    className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
                  >
                    Clear Filters
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-sky-400/10 px-3 py-2 text-sky-200">
                    Airline: {selectedAirline || "All"}
                  </span>
                  <span className="rounded-full bg-sky-400/10 px-3 py-2 text-sky-200">
                    Origin: {selectedAirport || "All"}
                  </span>
                  <span className="rounded-full bg-sky-400/10 px-3 py-2 text-sky-200">
                    Destination: {selectedDestination || "All"}
                  </span>
                </div>

                <div className="mt-5">
                  <label
                    htmlFor="combined-destination"
                    className="mb-2 block text-sm font-medium text-slate-200"
                  >
                    Select Destination Airport
                  </label>
                  <select
                    id="combined-destination"
                    value={selectedDestination}
                    onChange={(event) =>
                      setSelectedDestination(event.target.value)
                    }
                    disabled={combinedLoading || availableDestinations.length === 0}
                    className="w-full max-w-sm rounded-lg border border-white/20 bg-[#07152f] px-4 py-3 text-white disabled:opacity-60"
                  >
                    <option value="">All destinations</option>
                    {availableDestinations.map((airport) => (
                      <option key={airport} value={airport}>
                        {airport}
                      </option>
                    ))}
                  </select>
                </div>

                {combinedLoading && (
                  <p className="mt-5 text-slate-300" role="status">
                    Updating filtered performance...
                  </p>
                )}

                {combinedError && (
                  <p className="mt-5 text-red-300" role="alert">
                    {combinedError}
                  </p>
                )}

                {!combinedLoading && combinedPerformance && (
                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    {[
                      {
                        label: "Matching Flights",
                        value: formatNumber(combinedPerformance.total_flights),
                      },
                      {
                        label: "Delayed Flights",
                        value: formatNumber(combinedPerformance.delayed_flights),
                      },
                      {
                        label: "Delay Rate",
                        value: `${combinedPerformance.delay_rate_percent}%`,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-lg border border-white/10 bg-[#07152f] p-5"
                      >
                        <p className="text-sm text-slate-300">{item.label}</p>
                        <p className="mt-2 text-2xl font-bold">{item.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {!combinedLoading &&
                  combinedPerformance?.total_flights === 0 && (
                    <p className="mt-4 text-sm text-amber-200">
                      No historical flights match these filters.
                    </p>
                  )}
              </section>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-[#102344] p-6">
                  <h4 className="mb-5 text-lg font-semibold">
                    Airline Flight Volume
                  </h4>
                  <div className="space-y-4">
                    {analytics.airlines.slice(0, 6).map((item) => (
                      <div key={item.airline}>
                        <div className="mb-2 flex justify-between text-sm">
                          <span>{item.airline}</span>
                          <span>{formatNumber(item.total_flights)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10">
                          <div
                            className="h-2 rounded-full bg-sky-400"
                            style={{
                              width: `${
                                (item.total_flights /
                                  analytics.airlines[0].total_flights) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#102344] p-6">
                  <h4 className="mb-5 text-lg font-semibold">
                    Busiest Origin Airports
                  </h4>
                  <div className="space-y-4">
                    {analytics.airports.slice(0, 6).map((item) => (
                      <div
                        key={item.airport}
                        className="flex items-center justify-between border-b border-white/10 pb-3"
                      >
                        <span className="font-medium">{item.airport}</span>
                        <div className="text-right">
                          <p>{formatNumber(item.total_flights)} flights</p>
                          <p className="text-xs text-slate-400">
                            {item.delay_rate_percent}% delayed
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>


              <div className="rounded-xl border border-white/10 bg-[#102344] p-6">
                <h4 className="text-lg font-semibold">
                  Historical Delay Rate Trend
                </h4>
                <p className="mt-2 text-sm text-slate-300">
                  Daily percentage of delayed flights · January–March 2015
                </p>

                {analytics.daily.length > 1 ? (
                  <div className="mt-6">
                    <svg
                      viewBox="0 0 900 260"
                      role="img"
                      aria-label="Daily historical flight delay rates from January through March 2015"
                      className="h-auto w-full"
                    >
                      {[0, 10, 20, 30, 40, 50].map((tick) => (
                        <g key={tick}>
                          <line
                            x1="55"
                            x2="875"
                            y1={220 - tick * 4}
                            y2={220 - tick * 4}
                            stroke="#334155"
                            strokeDasharray="4 5"
                          />
                          <text
                            x="45"
                            y={224 - tick * 4}
                            textAnchor="end"
                            fontSize="12"
                            fill="#94a3b8"
                          >
                            {tick}%
                          </text>
                        </g>
                      ))}

                      <polyline
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={analytics.daily
                          .map((day, index) => {
                            const x =
                              55 +
                              (index / (analytics.daily.length - 1)) * 820;
                            const y =
                              220 -
                              Math.min(
                                55,
                                Math.max(0, day.delay_rate_percent)
                              ) * 4;
                            return `${x},${y}`;
                          })
                          .join(" ")}
                      />

                      {[
                        { date: "2015-01-01", label: "Jan 1" },
                        { date: "2015-02-01", label: "Feb 1" },
                        { date: "2015-03-01", label: "Mar 1" },
                      ].map((month) => {
                        const index = analytics.daily.findIndex(
                          (day) => day.date >= month.date
                        );

                        if (index < 0) return null;

                        const x =
                          55 +
                          (index / (analytics.daily.length - 1)) * 820;

                        return (
                          <g key={month.date}>
                            <line
                              x1={x}
                              x2={x}
                              y1="20"
                              y2="220"
                              stroke="#475569"
                              strokeDasharray="3 6"
                            />
                            <text
                              x={x}
                              y="248"
                              textAnchor={index === 0 ? "start" : "middle"}
                              fontSize="13"
                              fill="#cbd5e1"
                            >
                              {month.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-slate-300">
                    Insufficient historical data to display the trend.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-[#102344] p-6">
                <h4 className="mb-5 text-lg font-semibold">
                  Most Frequent Routes
                </h4>
                <div className="grid gap-3 md:grid-cols-2">
                  {analytics.routes.slice(0, 6).map((route) => (
                    <div
                      key={`${route.origin}-${route.destination}`}
                      className="rounded-lg border border-white/10 p-4"
                    >
                      <p className="font-semibold">
                        {route.origin} → {route.destination}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        {formatNumber(route.total_flights)} flights ·{" "}
                        {route.delay_rate_percent}% delayed
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
