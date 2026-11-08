"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Flight = {
  id: string;
  flight_number: string;
  flight_date: string;
  origin: string;
  destination: string;
  status: string;
  departure_delay_minutes: number | null;
};

type Summary = {
  total_flights: number;
  delayed_flights: number | null;
  cancelled_flights: number | null;
};

export default function PrivateOperations() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [flightDate, setFlightDate] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [status, setStatus] = useState("scheduled");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [editingStatuses, setEditingStatuses] =
    useState<Record<string, string>>({});
  const [updatingFlightId, setUpdatingFlightId] =
    useState<string | null>(null);
  const [updateError, setUpdateError] = useState("");
  const [updateSuccess, setUpdateSuccess] = useState("");



  useEffect(() => {
    const controller = new AbortController();

    async function loadOperations() {
      try {
        const options: RequestInit = {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        };

        const [summaryResponse, flightsResponse] = await Promise.all([
          fetch(`${API}/api/airline/operations/summary`, options),
          fetch(`${API}/api/airline/operations/flights`, options),
        ]);

        if (!summaryResponse.ok || !flightsResponse.ok) {
          throw new Error("Unable to load private airline operations.");
        }

        const summaryData = await summaryResponse.json();
        const flightsData = await flightsResponse.json();

        if (
          summaryData.data_scope !== "organization_private" ||
          flightsData.data_scope !== "organization_private"
        ) {
          throw new Error("Unexpected operational data scope.");
        }

        if (controller.signal.aborted) return;

        setSummary(summaryData.summary);
        setFlights(flightsData.flights);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load operational data."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadOperations();

    return () => controller.abort();
  }, [refreshKey]);



  async function handleUpdateStatus(flight: Flight) {
    if (updatingFlightId !== null) return;

    const nextStatus =
      editingStatuses[flight.id] ?? flight.status;

    if (nextStatus === flight.status) return;

    setUpdatingFlightId(flight.id);
    setUpdateError("");
    setUpdateSuccess("");

    try {
      const response = await fetch(
        `${API}/api/airline/operations/flights/${encodeURIComponent(flight.id)}/status`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Session expired. Please sign in again.");
        }
        if (response.status === 403) {
          throw new Error("You are not authorized to update this flight.");
        }
        if (response.status === 404) {
          throw new Error("Flight not found for your airline.");
        }

        const data = await response.json().catch(() => null);
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Unable to update flight status."
        );
      }

      const data = await response.json();

      if (
        data.data_scope !== "organization_private" ||
        data.flight?.id !== flight.id ||
        data.flight?.status !== nextStatus
      ) {
        throw new Error("Unexpected flight update response.");
      }

      setUpdateSuccess(
        `${flight.flight_number} updated to ${nextStatus}.`
      );

      setEditingStatuses((current) => {
        const updated = { ...current };
        delete updated[flight.id];
        return updated;
      });

      setRefreshKey((value) => value + 1);
    } catch (error) {
      setUpdateError(
        error instanceof Error
          ? error.message
          : "Unable to update flight."
      );
    } finally {
      setUpdatingFlightId(null);
    }
  }

  async function handleAddFlight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const response = await fetch(`${API}/api/airline/operations/flights`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flight_number: flightNumber.trim().toUpperCase(),
          flight_date: flightDate,
          origin: origin.trim().toUpperCase(),
          destination: destination.trim().toUpperCase(),
          status,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Your session expired. Please sign in again.");
        }
        if (response.status === 403) {
          throw new Error("You are not authorized to add flights.");
        }
        const result = await response.json().catch(() => null);
        throw new Error(
          typeof result?.detail === "string"
            ? result.detail
            : "Unable to create flight. Check the entered information."
        );
      }

      setSaveSuccess("Flight added successfully.");
      setFlightNumber("");
      setFlightDate("");
      setOrigin("");
      setDestination("");
      setStatus("scheduled");
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Unable to add flight."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6 rounded-xl border border-sky-500/30 bg-[#102344] p-7">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-sky-400">
          Organization-Private Data
        </p>

        <h3 className="mt-2 text-2xl font-bold">
          Private Airline Operations
        </h3>

        <p className="mt-2 text-sm text-slate-300">
          Operational records belonging to your authenticated airline.
          These are separate from shared historical aviation research data.
        </p>
      </div>

      {loading && (
        <p className="text-slate-300">Loading airline operations...</p>
      )}

      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && summary && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Total Flights", summary.total_flights],
              ["Delayed Flights", summary.delayed_flights ?? 0],
              ["Cancelled Flights", summary.cancelled_flights ?? 0],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-white/10 bg-[#07152f] p-5"
              >
                <p className="text-sm text-slate-300">{label}</p>
                <p className="mt-2 text-3xl font-bold">
                  {Number(value).toLocaleString("en-US")}
                </p>
              </div>
            ))}
          </div>


          <form
            onSubmit={handleAddFlight}
            className="space-y-4 rounded-lg border border-white/10 bg-[#07152f] p-5"
          >
            <h4 className="text-lg font-semibold">Add Operational Flight</h4>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="block text-slate-300">Flight Number</span>
                <input
                  required
                  minLength={2}
                  maxLength={12}
                  value={flightNumber}
                  onChange={(event) => setFlightNumber(event.target.value)}
                  placeholder="FG401"
                  className="w-full rounded-lg border border-slate-600 bg-[#102344] p-3"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="block text-slate-300">Flight Date</span>
                <input
                  required
                  type="date"
                  value={flightDate}
                  onChange={(event) => setFlightDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-[#102344] p-3"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="block text-slate-300">Origin Airport</span>
                <input
                  required
                  minLength={3}
                  maxLength={3}
                  pattern="[A-Za-z]{3}"
                  value={origin}
                  onChange={(event) => setOrigin(event.target.value)}
                  placeholder="DFW"
                  className="w-full rounded-lg border border-slate-600 bg-[#102344] p-3 uppercase"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="block text-slate-300">Destination Airport</span>
                <input
                  required
                  minLength={3}
                  maxLength={3}
                  pattern="[A-Za-z]{3}"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder="JFK"
                  className="w-full rounded-lg border border-slate-600 bg-[#102344] p-3 uppercase"
                />
              </label>

              <label className="space-y-2 text-sm md:col-span-2">
                <span className="block text-slate-300">Flight Status</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-[#102344] p-3"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="departed">Departed</option>
                  <option value="arrived">Arrived</option>
                  <option value="delayed">Delayed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="diverted">Diverted</option>
                </select>
              </label>
            </div>

            {saveError && (
              <p role="alert" className="text-sm text-red-300">
                {saveError}
              </p>
            )}

            {saveSuccess && (
              <p role="status" className="text-sm text-emerald-300">
                {saveSuccess}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? "Saving Flight..." : "Add Flight"}
            </button>
          </form>

          <div>
            <h4 className="mb-4 text-lg font-semibold">
              Operational Flight Records
            </h4>

            
{updateError && (
  <p role="alert" className="mb-3 text-sm text-red-300">
    {updateError}
  </p>
)}
{updateSuccess && (
  <p role="status" className="mb-3 text-sm text-emerald-300">
    {updateSuccess}
  </p>
)}

{flights.length === 0 ? (
              <p className="rounded-lg border border-white/10 p-5 text-slate-300">
                No operational flights have been added for your airline yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/20 text-slate-300">
                    <tr>
                      <th className="p-3">Flight</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Route</th>
                      <th className="p-3">Status</th>
<th className="p-3">Update Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {flights.map((flight) => (
                      <tr
                        key={flight.id}
                        className="border-b border-white/10"
                      >
                        <td className="p-3">{flight.flight_number}</td>
                        <td className="p-3">{flight.flight_date}</td>
                        <td className="p-3">
                          {flight.origin} → {flight.destination}
                        </td>
                        
<td className="p-3 capitalize">{flight.status}</td>
<td className="p-3">
  <div className="flex flex-wrap items-center gap-2">
    <select
      aria-label={`New status for ${flight.flight_number}`}
      value={editingStatuses[flight.id] ?? flight.status}
      onChange={(event) =>
        setEditingStatuses((current) => ({
          ...current,
          [flight.id]: event.target.value,
        }))
      }
      disabled={updatingFlightId !== null}
      className="rounded-lg border border-slate-600 bg-[#102344] p-2 text-sm"
    >
      <option value="scheduled">Scheduled</option>
      <option value="departed">Departed</option>
      <option value="arrived">Arrived</option>
      <option value="delayed">Delayed</option>
      <option value="cancelled">Cancelled</option>
      <option value="diverted">Diverted</option>
    </select>

    <button
      type="button"
      onClick={() => handleUpdateStatus(flight)}
      disabled={
        updatingFlightId !== null ||
        (editingStatuses[flight.id] ?? flight.status) === flight.status
      }
      className="rounded-lg bg-blue-600 px-3 py-2 font-semibold hover:bg-blue-500 disabled:opacity-50"
    >
      {updatingFlightId === flight.id
        ? "Updating..."
        : "Update"}
    </button>
  </div>
</td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
