"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Flight = {
  id: string;
  flight_number: string;
  flight_date: string;
  origin: string;
  destination: string;
  status: string;
};

type Summary = {
  total_flights: number;
  delayed_flights: number | null;
  cancelled_flights: number | null;
};

export default function AirlineResultsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const options: RequestInit = {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        };

        const [a, b] = await Promise.all([
          fetch(`${API}/api/airline/operations/summary`, options),
          fetch(`${API}/api/airline/operations/flights?limit=500`, options),
        ]);

        if (!a.ok || !b.ok) {
          throw new Error(
            a.status === 401 || b.status === 401
              ? "Please sign in to your airline account."
              : "Unable to load airline results."
          );
        }

        const summaryData = await a.json();
        const flightData = await b.json();

        if (
          summaryData.data_scope !== "organization_private" ||
          flightData.data_scope !== "organization_private"
        ) {
          throw new Error("Unexpected data scope.");
        }

        if (!controller.signal.aborted) {
          setSummary(summaryData.summary);
          setFlights(flightData.flights);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Request failed.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, []);

  const metrics = summary
    ? [
        ["Total Flights", summary.total_flights],
        ["Delayed Flights", summary.delayed_flights ?? 0],
        ["Cancelled Flights", summary.cancelled_flights ?? 0],
        [
          "Delay Rate",
          summary.total_flights
            ? `${(((summary.delayed_flights ?? 0) / summary.total_flights) * 100).toFixed(1)}%`
            : "0%",
        ],
      ]
    : [];

  return (
    <main className="min-h-screen w-full bg-[#071326] text-white shadow-[0_0_0_100vmax_#071326] clip-path-none mx-auto max-w-7xl space-y-8 px-6 py-12 text-white">
      <div>
        <p className="text-sm uppercase tracking-widest text-sky-400">
          Organization-Private Results
        </p>
        <h1 className="mt-2 text-4xl font-bold">Airline Results</h1>
        <p className="mt-3 text-slate-300">
          Results from your airline's operational records,
          separate from shared historical research data.
        </p>
      </div>

      {loading && <p>Loading results...</p>}
      {error && <p role="alert" className="text-red-300">{error}</p>}

      {!loading && !error && summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-[#102344] p-6"
              >
                <p className="text-sm text-slate-300">{label}</p>
                <p className="mt-3 text-3xl font-bold">{value}</p>
              </div>
            ))}
          </div>

          <section className="rounded-xl border border-white/10 bg-[#102344] p-6">
            <h2 className="mb-5 text-xl font-semibold">
              Recent Operational Flights
            </h2>
            {flights.length === 0 ? (
              <p className="text-slate-300">No flights available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/20">
                    <tr>
                      {["Flight", "Date", "Route", "Status"].map((h) => (
                        <th key={h} className="p-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {flights.map((f) => (
                      <tr key={f.id} className="border-b border-white/10">
                        <td className="p-3">{f.flight_number}</td>
                        <td className="p-3">{f.flight_date}</td>
                        <td className="p-3">{f.origin} → {f.destination}</td>
                        <td className="p-3 capitalize">{f.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
