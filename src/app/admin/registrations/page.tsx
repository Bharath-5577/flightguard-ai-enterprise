"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Registration = {
  id: string;
  full_name: string;
  organization_name: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export default function RegistrationManagement() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRegistrations = useCallback(async () => {
    setError("");

    try {
      const response = await fetch(
        `${API}/api/admin/registrations`,
        {
          cache: "no-store",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Unable to load registrations.");
      }

      const data = await response.json();
      setRegistrations(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Connection failed."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRegistrations();
  }, [loadRegistrations]);

  async function updateStatus(
    id: string,
    status: "approved" | "rejected"
  ) {
    setProcessing(id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API}/api/admin/registrations/${id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Unable to update registration."
        );
      }

      setMessage(`Registration ${status} successfully.`);
      await loadRegistrations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Update failed."
      );
    } finally {
      setProcessing(null);
    }
  }

  const pending = registrations.filter(
    (r) => r.status === "pending"
  ).length;

  const approved = registrations.filter(
    (r) => r.status === "approved"
  ).length;

  const rejected = registrations.filter(
    (r) => r.status === "rejected"
  ).length;

  return (
    <main className="min-h-screen bg-[#07152f] p-6 text-white md:p-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-widest text-sky-400">
              FLIGHTGUARD AI
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Customer Registration Management
            </h1>

            <p className="mt-2 text-slate-400">
              Review airline organizations and registration requests.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-lg border border-slate-600 px-5 py-3 text-sm hover:bg-slate-800"
          >
            ← Admin Dashboard
          </Link>
        </header>

        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Total Registrations",
              value: registrations.length,
              color: "text-white",
            },
            {
              label: "Pending Approval",
              value: pending,
              color: "text-amber-400",
            },
            {
              label: "Approved",
              value: approved,
              color: "text-emerald-400",
            },
            {
              label: "Rejected",
              value: rejected,
              color: "text-red-400",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-slate-700 bg-[#102344] p-6"
            >
              <p className="text-sm text-slate-400">
                {card.label}
              </p>

              <p className={`mt-3 text-4xl font-bold ${card.color}`}>
                {card.value}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-8 overflow-hidden rounded-xl border border-slate-700 bg-[#102344]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 p-6">
            <div>
              <h2 className="text-xl font-semibold">
                Airline Registration Requests
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Registration records from the FlightGuard AI database.
              </p>
            </div>

            <button
              onClick={() => {
                setLoading(true);
                void loadRegistrations();
              }}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold hover:bg-blue-500"
            >
              Refresh
            </button>
          </div>

          {error && (
            <p role="alert" className="m-5 rounded-lg bg-red-950 p-4 text-red-300">
              {error}
            </p>
          )}

          {message && (
            <p role="status" className="m-5 rounded-lg bg-emerald-950 p-4 text-emerald-300">
              {message}
            </p>
          )}

          {loading ? (
            <p className="p-8 text-slate-400">
              Loading customer registrations...
            </p>
          ) : registrations.length === 0 ? (
            <p className="p-8 text-slate-400">
              No registration requests found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#07152f] text-slate-300">
                  <tr>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Organization</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Submitted</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {registrations.map((registration) => (
                    <tr
                      key={registration.id}
                      className="border-t border-slate-700"
                    >
                      <td className="p-4 font-medium">
                        {registration.full_name}
                      </td>

                      <td className="p-4">
                        {registration.organization_name}
                      </td>

                      <td className="p-4 text-slate-300">
                        {registration.email}
                      </td>

                      <td className="p-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            registration.status === "approved"
                              ? "bg-emerald-900 text-emerald-300"
                              : registration.status === "rejected"
                              ? "bg-red-900 text-red-300"
                              : "bg-amber-900 text-amber-300"
                          }`}
                        >
                          {registration.status.toUpperCase()}
                        </span>
                      </td>

                      <td className="p-4 text-slate-400">
                        {registration.created_at}
                      </td>

                      <td className="p-4">
                        {registration.status === "pending" ? (
                          <div className="flex gap-2">
                            <button
                              disabled={processing !== null}
                              onClick={() =>
                                updateStatus(
                                  registration.id,
                                  "approved"
                                )
                              }
                              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-50"
                            >
                              Approve
                            </button>

                            <button
                              disabled={processing !== null}
                              onClick={() =>
                                updateStatus(
                                  registration.id,
                                  "rejected"
                                )
                              }
                              className="rounded-lg bg-red-600 px-4 py-2 font-semibold hover:bg-red-500 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500">
                            Reviewed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
