"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function AdminRegisterPage() {
  const router = useRouter();

  const [available, setAvailable] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/api/admin/setup/status`)
      .then((res) => {
        if (!res.ok) throw new Error("Unable to check setup status.");
        return res.json();
      })
      .then((data) => setAvailable(data.setup_available))
      .catch(() => setError("Cannot connect to the backend."));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/api/admin/setup/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          setup_code: setupCode,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Administrator registration failed."
        );
      }

      router.push("/admin/login?created=1");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Registration failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-16 text-white">
      <div className="mx-auto max-w-md">
        <Link href="/welcome" className="text-sm text-sky-400">
          ← Back to FlightGuard AI
        </Link>

        <div className="mt-10 rounded-2xl border border-slate-700 bg-slate-900 p-8">
          <div className="mb-4 text-3xl">✈</div>

          <h1 className="text-2xl font-bold">
            Platform Administrator Setup
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Create the first FlightGuard AI administrator account.
          </p>

          {available === false ? (
            <div className="mt-8">
              <p className="text-amber-300">
                Administrator setup has already been completed.
              </p>
              <Link
                href="/admin/login"
                className="mt-4 inline-block text-sky-400"
              >
                Go to administrator login →
              </Link>
            </div>
          ) : available === null && !error ? (
            <p className="mt-8 text-slate-400">
              Checking setup availability...
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {[
                {
                  label: "Full name",
                  value: name,
                  set: setName,
                  type: "text",
                },
                {
                  label: "Email address",
                  value: email,
                  set: setEmail,
                  type: "email",
                },
                {
                  label: "Password",
                  value: password,
                  set: setPassword,
                  type: "password",
                },
                {
                  label: "Confirm password",
                  value: confirmPassword,
                  set: setConfirmPassword,
                  type: "password",
                },
                {
                  label: "One-time setup code",
                  value: setupCode,
                  set: setSetupCode,
                  type: "password",
                },
              ].map((field) => (
                <label key={field.label} className="block">
                  <span className="mb-2 block text-sm text-slate-300">
                    {field.label}
                  </span>
                  <input
                    type={field.type}
                    value={field.value}
                    onChange={(e) => field.set(e.target.value)}
                    required
                    minLength={
                      field.label === "Password" ? 12 : undefined
                    }
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-white outline-none focus:border-sky-500"
                  />
                </label>
              ))}

              {error && (
                <p role="alert" className="text-sm text-red-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || available !== true}
                className="w-full rounded-lg bg-sky-600 px-5 py-3 font-semibold hover:bg-sky-500 disabled:opacity-50"
              >
                {loading
                  ? "Creating administrator..."
                  : "Create Administrator Account"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
