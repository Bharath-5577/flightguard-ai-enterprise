"use client";

import { useState, type FormEvent } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Prediction = {
  model: string;
  target: string;
  risk_score: number;
  risk_score_percent: number;
  historical_research: boolean;
  calibrated_probability: boolean;
  live_forecast: boolean;
  notice: string;
};

const initial = {
  Reporting_Airline: "AA",
  Origin: "DFW",
  Dest: "ORD",
  Distance: 802,
  CRSElapsedTime: 145,
  ScheduledHour: 14,
  Month: 6,
  DayOfWeek: 0,
  tmpf: 80,
  dwpf: 65,
  sknt: 8,
  vsby: 10,
  mslp: 1013,
  p01i: 0,
};

const fields: { key: keyof typeof initial; label: string }[] = [
  { key: "Reporting_Airline", label: "Airline Code" },
  { key: "Origin", label: "Origin Airport" },
  { key: "Dest", label: "Destination Airport" },
  { key: "Distance", label: "Distance (miles)" },
  { key: "CRSElapsedTime", label: "Scheduled Flight Duration (minutes)" },
  { key: "ScheduledHour", label: "Scheduled Departure Hour (0–23)" },
  { key: "Month", label: "Month (1–12)" },
  { key: "DayOfWeek", label: "Day of Week (0=Monday)" },
  { key: "tmpf", label: "Temperature (°F)" },
  { key: "dwpf", label: "Dew Point (°F)" },
  { key: "sknt", label: "Wind Speed (knots)" },
  { key: "vsby", label: "Visibility (miles)" },
  { key: "mslp", label: "Sea-Level Pressure (hPa)" },
  { key: "p01i", label: "Hourly Precipitation (inches)" },
];

export default function CancellationPredictionPage() {
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(key: keyof typeof initial, value: string) {
    setResult(null);
    setForm(previous => ({
      ...previous,
      [key]: typeof initial[key] === "number"
        ? (value === "" ? Number.NaN : Number(value))
        : value.toUpperCase(),
    }));
  }

  async function predict(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API}/api/predictions/cancellation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: form }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : `Prediction failed (HTTP ${response.status})`
        );
      }

      if (
        typeof data.risk_score !== "number" ||
        !Number.isFinite(data.risk_score) ||
        data.risk_score < 0 ||
        data.risk_score > 1 ||
        data.historical_research !== true
      ) {
        throw new Error("Unexpected prediction response.");
      }

      setResult(data as Prediction);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07152f] px-5 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <a href="/" className="text-sm text-cyan-300 hover:underline">
          ← FlightGuard AI Dashboard
        </a>

        <div className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-cyan-300">
            FlightGuard AI / Research
          </p>
          <h1 className="mt-3 text-3xl font-bold md:text-4xl">
            Flight Cancellation Risk
          </h1>
          <p className="mt-3 max-w-3xl text-slate-300">
            Explore the 2025 Histogram Gradient Boosting cancellation model using
            historical flight schedules and NOAA weather features.
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
          Research demonstration only. Scores are not calibrated cancellation
          probabilities or live flight forecasts. Enter feature values
          consistent with the historical training dataset.
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <form
            onSubmit={predict}
            className="rounded-2xl border border-slate-700 bg-[#102344] p-6"
          >
            <h2 className="mb-5 text-xl font-semibold">Flight and Weather Inputs</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map(({ key, label }) => (
                <label key={key} className="block">
                  <span className="mb-2 block text-sm text-slate-300">
                    {label}
                  </span>
                  <input
                    required
                    type={typeof initial[key] === "number" ? "number" : "text"}
                    step={typeof initial[key] === "number" ? "any" : undefined}
                    value={form[key]}
                    onChange={event => update(key, event.target.value)}
                    className="w-full rounded-lg border border-slate-600 bg-[#07152f] px-3 py-3 text-white outline-none focus:border-cyan-400"
                  />
                </label>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-[#07152f] hover:bg-cyan-400 disabled:opacity-60"
            >
              {loading ? "Calculating..." : "Predict Historical Cancellation Risk"}
            </button>
          </form>

          <section
            aria-live="polite"
            className="h-fit rounded-2xl border border-slate-700 bg-[#102344] p-6"
          >
            <h2 className="text-xl font-semibold">Prediction Result</h2>

            {error && (
              <p role="alert" className="mt-5 rounded-lg bg-red-500/10 p-4 text-red-300">
                {error}
              </p>
            )}

            {!result && !error && (
              <p className="mt-5 text-slate-400">
                Enter your historical scenario and submit the form to see
                the model score.
              </p>
            )}

            {result && (
              <div className="mt-6">
                <p className="text-sm text-slate-300">Model Risk Score</p>
                <p className="mt-2 text-5xl font-bold text-cyan-300">
                  {(result.risk_score * 100).toFixed(2)}%
                </p>

                <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{
                      width: `${Math.min(100, Math.max(0, result.risk_score * 100))}%`,
                    }}
                  />
                </div>

                <p className="mt-5 text-sm text-slate-300">
                  Model: {result.model}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Target: Flight Cancellation
                </p>
                <p className="mt-5 rounded-lg border border-slate-600 p-4 text-sm text-slate-300">
                  {result.notice}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
