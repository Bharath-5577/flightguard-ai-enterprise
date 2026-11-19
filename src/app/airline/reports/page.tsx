"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Flight = {
  flight_number: string;
  flight_date: string;
  origin: string;
  destination: string;
  status: string;
  departure_delay_minutes: number | null;
};

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[\\s]*[=+@-]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export default function AirlineReportsPage() {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function exportFlights() {
    setWorking(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API}/api/airline/operations/flights?limit=500`,
        { credentials: "include", cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Unable to retrieve authorized airline records.");
      }

      const data = await response.json();

      if (
        data.data_scope !== "organization_private" ||
        !Array.isArray(data.flights)
      ) {
        throw new Error("Unexpected report data.");
      }

      const columns: (keyof Flight)[] = [
        "flight_number",
        "flight_date",
        "origin",
        "destination",
        "status",
        "departure_delay_minutes",
      ];

      const csv = [
        columns.join(","),
        ...data.flights.map((flight: Flight) =>
          columns.map((column) => csvCell(flight[column])).join(",")
        ),
      ].join("\\r\\n");

      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8",
      });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "flightguard-airline-operations.csv";
      anchor.click();
      URL.revokeObjectURL(url);

      setSuccess(
        `Exported ${data.flights.length} operational records (maximum 500).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="min-h-screen w-full bg-[#071326] text-white shadow-[0_0_0_100vmax_#071326] clip-path-none mx-auto max-w-5xl space-y-8 px-6 py-12 text-white">
      <h1 className="text-4xl font-bold">Airline Reports</h1>
      <p className="text-slate-300">
        Export your airline's private operational flight records.
        This report does not contain shared historical data.
      </p>

      <section className="rounded-xl border border-white/10 bg-[#102344] p-8">
        <h2 className="text-xl font-semibold">Operational Flights CSV</h2>
        <p className="mt-3 text-slate-300">
          Download up to 500 of your most recent operational records.
        </p>

        <button
          onClick={exportFlights}
          disabled={working}
          className="mt-6 rounded-lg bg-blue-600 px-6 py-3 font-semibold disabled:opacity-50"
        >
          {working ? "Preparing..." : "Download CSV Report"}
        </button>

        {error && <p role="alert" className="mt-4 text-red-300">{error}</p>}
        {success && <p role="status" className="mt-4 text-emerald-300">{success}</p>}
      </section>
    </main>
  );
}
