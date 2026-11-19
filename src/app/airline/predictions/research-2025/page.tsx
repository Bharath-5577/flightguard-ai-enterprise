"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const initial = {
  Reporting_Airline: "AA",
  Origin: "DFW",
  Dest: "LAX",
  Distance: "1235",
  CRSElapsedTime: "190",
  ScheduledHour: "14",
  Month: "11",
  DayOfWeek: "2",
  tmpf: "70",
  dwpf: "55",
  sknt: "10",
  vsby: "10",
  mslp: "1015",
  p01i: "0",
};

type Feature = keyof typeof initial;

type Result = {
  model: string;
  model_score: number;
  classification_threshold: number;
  elevated_delay_risk: boolean;
  target: string;
  historical_research: boolean;
  calibrated_probability: boolean;
  live_forecast: boolean;
  notice: string;
};

const labels: Record<Feature, string> = {
  Reporting_Airline: "Airline Code",
  Origin: "Origin Airport",
  Dest: "Destination Airport",
  Distance: "Distance (miles)",
  CRSElapsedTime: "Scheduled Flight Duration (minutes)",
  ScheduledHour: "Scheduled Departure Hour (0–23)",
  Month: "Month (1–12)",
  DayOfWeek: "Day of Week (0–6)",
  tmpf: "Temperature (°F)",
  dwpf: "Dew Point (°F)",
  sknt: "Wind Speed (knots)",
  vsby: "Visibility (miles)",
  mslp: "Sea Level Pressure (hPa)",
  p01i: "One-Hour Precipitation (inches)",
};

const categorical: Feature[] = [
  "Reporting_Airline",
  "Origin",
  "Dest",
];

export default function Research2025Page() {
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    const features: Record<string, string | number | null> = {};

    for (const key of Object.keys(form) as Feature[]) {
      const value = form[key].trim();

      if (categorical.includes(key)) {
        features[key] = value.toUpperCase();
      } else {
        features[key] = value === "" ? null : Number(value);
      }
    }

    try {
      const response = await fetch(
        `${API}/api/predictions/delay-2025-research`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ features }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const detail = data.detail;
        throw new Error(
          typeof detail === "string"
            ? detail
            : `Prediction failed (HTTP ${response.status})`
        );
      }

      setResult(data as Result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Prediction unavailable."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#071326] px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/airline/predictions"
          className="text-sm text-sky-400 hover:underline"
        >
          ← Back to AI Predictions
        </Link>

        <h1 className="mt-6 text-3xl font-bold">
          2025 Historical Delay Research
        </h1>

        <p className="mt-3 text-slate-300">
          Gradient Boosting model using historical flight schedules
          and weather observations.
        </p>

        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Research demonstration only. Weather inputs must represent
          observations available at least two hours before departure.
          This model is not validated for live operational forecasting.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            {(Object.keys(initial) as Feature[]).map((key) => (
              <label key={key} className="block">
                <span className="mb-2 block text-sm text-slate-300">
                  {labels[key]}
                </span>
                <input
                  type={categorical.includes(key) ? "text" : "number"}
                  step={categorical.includes(key) ? undefined : "any"}
                  required={
                    categorical.includes(key) ||
                    ["Distance", "CRSElapsedTime", "ScheduledHour",
                     "Month", "DayOfWeek"].includes(key)
                  }
                  value={form[key]}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      [key]: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-white/15 bg-[#102344] px-4 py-3 text-white outline-none focus:border-sky-400"
                />
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-sky-500 px-6 py-3 font-semibold text-[#071326] hover:bg-sky-400 disabled:opacity-50"
          >
            {loading ? "Evaluating..." : "Evaluate Historical Delay Risk"}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-6 rounded-lg border border-red-500/40 p-4 text-red-300">
            {error}
          </p>
        )}

        {result && (
          <section className="mt-8 rounded-xl border border-white/15 bg-[#102344] p-6">
            <h2 className="text-2xl font-semibold">Research Result</h2>

            <p className="mt-4 text-lg">
              Classification:{" "}
              <strong>
                {result.elevated_delay_risk
                  ? "Elevated Delay Risk"
                  : "Below Risk Threshold"}
              </strong>
            </p>

            <p className="mt-3">
              Model score: {result.model_score.toFixed(4)}
            </p>

            <p className="mt-2">
              Classification threshold:{" "}
              {result.classification_threshold.toFixed(4)}
            </p>

            <p className="mt-4 text-sm text-slate-300">
              This score is not a calibrated probability of delay.
            </p>

            <p className="mt-3 text-sm text-amber-200">
              {result.notice}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
