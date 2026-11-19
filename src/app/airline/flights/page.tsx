"use client";

import Link from "next/link";
import PrivateOperations from "../dashboard/PrivateOperations";

export default function AirlineFlightsPage() {
  return (
    <main className="min-h-screen w-full bg-[#071326] text-white shadow-[0_0_0_100vmax_#071326] clip-path-none mx-auto max-w-7xl space-y-8 px-6 py-12 text-white">
      <div>
        <p className="text-sm uppercase tracking-widest text-sky-400">
          Airline Customer Portal
        </p>
        <h1 className="mt-2 text-4xl font-bold">Flight Management</h1>
        <p className="mt-3 text-slate-300">
          Manage your airline's private operational flight records.
        </p>
      </div>

      <PrivateOperations />

      <Link href="/airline/dashboard" className="text-sky-400">
        Back to Airline Dashboard
      </Link>
    </main>
  );
}
