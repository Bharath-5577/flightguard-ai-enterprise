"use client";

import { useState, type FormEvent } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const initial = {
  Reporting_Airline: "AA",
  Dest: "LAX",
  Distance: 2475,
  departure_hour: 9,
  departure_day_of_week: 3,
  departure_month: 1,
  departure_is_weekend: 0,
  temperature_c: -1.7,
  wind_speed_ms: 6.2,
  visibility_m: 16093,
  precipitation_mm: 0,
  weather_age_minutes: 9,
};

type Features = typeof initial;
type Prediction = {
  model: string;
  model_score: number;
  classification_threshold: number;
  elevated_delay_risk: boolean;
  target: string;
  training_scope: string;
  calibrated_probability: boolean;
  live_forecast: boolean;
  notice: string;
};

const fields: { key: keyof Features; label: string }[] = [
  { key: "Reporting_Airline", label: "Airline code" },
  { key: "Dest", label: "Destination airport code" },
  { key: "Distance", label: "Distance (miles)" },
  { key: "departure_hour", label: "Departure hour (0–23)" },
  { key: "departure_day_of_week", label: "Day of week (Monday=0)" },
  { key: "departure_month", label: "Month (1–12)" },
  { key: "departure_is_weekend", label: "Weekend (0=No, 1=Yes)" },
  { key: "temperature_c", label: "Temperature (°C)" },
  { key: "wind_speed_ms", label: "Wind speed (m/s)" },
  { key: "visibility_m", label: "Visibility (meters)" },
  { key: "precipitation_mm", label: "Precipitation (mm)" },
  { key: "weather_age_minutes", label: "Weather observation age (minutes)" },
];

export default function DelayPredictionPage() {
  const [form, setForm] = useState<Features>(initial);
  const [result, setResult] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(key: keyof Features, value: string) {
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
      const numericValues = Object.entries(form)
        .filter(([key]) => typeof initial[key as keyof Features] === "number")
        .map(([, value]) => value as number);

      if (numericValues.some(value => !Number.isFinite(value))) {
        throw new Error("Enter valid numbers in every numeric field.");
      }

      if (form.departure_is_weekend !== Number(form.departure_day_of_week >= 5)) {
        throw new Error("Weekend flag must match the selected day of week.");
      }

      const response = await fetch(`${API}/api/predictions/delay`, {
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
        data.model !== "catboost_validated" ||
        typeof data.model_score !== "number" ||
        !Number.isFinite(data.model_score) ||
        data.model_score < 0 ||
        data.model_score > 1 ||
        typeof data.classification_threshold !== "number" ||
        !Number.isFinite(data.classification_threshold) ||
        typeof data.elevated_delay_risk !== "boolean" ||
        data.training_scope !== "historical_JFK_departures" ||
        data.calibrated_probability !== false ||
        data.live_forecast !== false
      ) {
        throw new Error("Unexpected delay prediction response.");
      }

      setResult(data as Prediction);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#0b1220",
      color: "#f8fafc",
      padding: "40px 24px",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <a href="/" style={{ color: "#93c5fd", textDecoration: "none" }}>
          ← Back to Dashboard
        </a>

        <h1 style={{ fontSize: 32, marginTop: 28 }}>
          Flight Delay Prediction
        </h1>
        <p style={{ color: "#94a3b8", lineHeight: 1.7 }}>
          Historical JFK departure research model. Predicts whether a
          departure delay of at least 15 minutes is classified as elevated risk.
          Origin is fixed to JFK because that is the model training scope.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 24,
          marginTop: 28
        }}>
          <form onSubmit={predict} style={{
            background: "#111c2e",
            padding: 24,
            borderRadius: 16,
            border: "1px solid #273449"
          }}>
            <h2 style={{ marginTop: 0 }}>Flight and Weather Inputs</h2>
            <p style={{ color: "#94a3b8" }}>Origin: JFK (fixed)</p>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 16
            }}>
              {fields.map(field => (
                <label key={field.key} style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                  fontSize: 13,
                  color: "#cbd5e1"
                }}>
                  {field.label}
                  <input
                    required
                    type={typeof initial[field.key] === "number" ? "number" : "text"}
                    step={typeof initial[field.key] === "number" ? "any" : undefined}
                    value={form[field.key]}
                    onChange={event => update(field.key, event.target.value)}
                    style={{
                      padding: 11,
                      borderRadius: 8,
                      background: "#0b1220",
                      border: "1px solid #334155",
                      color: "#f8fafc",
                      width: "100%",
                      boxSizing: "border-box"
                    }}
                  />
                </label>
              ))}
            </div>

            <button type="submit" disabled={loading} style={{
              marginTop: 24,
              padding: "14px 22px",
              width: "100%",
              background: "#2563eb",
              border: "none",
              borderRadius: 9,
              color: "white",
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer"
            }}>
              {loading ? "Predicting..." : "Predict Delay Risk"}
            </button>
          </form>

          <section style={{
            background: "#111c2e",
            padding: 24,
            borderRadius: 16,
            border: "1px solid #273449",
            alignSelf: "start"
          }}>
            <h2 style={{ marginTop: 0 }}>Prediction Result</h2>

            {error && <p role="alert" style={{ color: "#fca5a5" }}>{error}</p>}

            {!result && !error && (
              <p style={{ color: "#94a3b8" }}>
                Enter a historical JFK flight scenario and select Predict Delay Risk.
              </p>
            )}

            {result && (
              <div>
                <p style={{ color: "#94a3b8" }}>Model score</p>
                <div style={{ fontSize: 44, fontWeight: 800 }}>
                  {(result.model_score * 100).toFixed(2)}%
                </div>

                <p>
                  Classification threshold:{" "}
                  {(result.classification_threshold * 100).toFixed(0)}%
                </p>

                <h3 style={{
                  color: result.elevated_delay_risk ? "#fbbf24" : "#86efac"
                }}>
                  {result.elevated_delay_risk
                    ? "Elevated Delay Risk"
                    : "Below Elevated-Risk Threshold"}
                </h3>

                <p style={{ color: "#94a3b8" }}>
                  Model: {result.model}
                </p>
                <p style={{ color: "#94a3b8", lineHeight: 1.7 }}>
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
