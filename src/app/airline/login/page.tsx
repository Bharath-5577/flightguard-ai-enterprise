"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AirlineLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          portal: "airline",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Unable to sign in."
        );
      }

      router.replace("/airline/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Authentication failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07152f] px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#102344] p-9 shadow-2xl">
        <div className="mb-7 text-center text-4xl">✈️</div>

        <h1 className="text-center text-3xl font-bold">
          Airline Customer Login
        </h1>

        <p className="mt-3 text-center text-sm text-slate-300">
          Access your FlightGuard AI workspace
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="airline-email" className="mb-2 block text-sm">
              Business Email
            </label>
            <input
              id="airline-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder="operations@airline.com"
              className="w-full rounded-lg border border-slate-600 bg-[#07152f] p-3 text-white"
            />
          </div>

          <div>
            <label htmlFor="airline-password" className="mb-2 block text-sm">
              Password
            </label>
            <input
              id="airline-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="w-full rounded-lg border border-slate-600 bg-[#07152f] p-3 text-white"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 p-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-slate-300">
          New airline customer?{" "}
          <Link href="/airline/register" className="font-semibold text-sky-400">
            Register your airline
          </Link>
        </p>

        <Link href="/welcome" className="mt-5 block text-center text-sm text-sky-400">
          ← Back to FlightGuard AI
        </Link>
      </div>
    </main>
  );
}
