"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Health = {
  status: string;
  service: string;
  llm_connected: boolean;
  llm_configured: boolean;
  llm_model_available: boolean;
  llm_provider: string;
  llm_model: string;
};

type Check = {
  available: boolean;
  detail: string;
  size_mb?: number;
};

type MonitoringHealth = {
  status: string;
  service: string;
  checked_at: string;
  checks: {
    authentication_database: Check;
    historical_flights_database: Check;
    airline_operations_database: Check;
    historical_dataset: Check;
  };
};


type HistoricalModel = {
  name: string;
  available: boolean;
  evaluation_split: string;
  metrics?: Record<string, number>;
  limitations?: string[];
  detail?: string;
};

type ModelMonitoring = {
  evaluation_type: string;
  live_evaluation: boolean;
  models: {
    departure_delay: HistoricalModel;
    cancellation: HistoricalModel;
  };
  notice: string;
};

function HistoricalModelCard({ model }: { model: HistoricalModel }) {
  const metrics = model.metrics || {};
  const fields = [
    ["ROC-AUC", "roc_auc"],
    ["Precision", "precision"],
    ["Recall", "recall"],
    ["F1 Score", "f1"],
    ["PR-AUC", "pr_auc"],
    ["Accuracy", "accuracy"],
  ] as const;

  return (
    <section className="rounded-xl border border-white/10 bg-[#102344] p-6">
      <h3 className="text-xl font-bold">{model.name}</h3>
      <p className="mt-2 text-sm text-slate-400">
        {model.evaluation_split}
      </p>

      {!model.available ? (
        <p className="mt-4 text-amber-300">
          {model.detail || "Evaluation report unavailable"}
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-4">
            {fields.filter(([, key]) => metrics[key] !== undefined)
              .map(([label, key]) => (
                <div key={key} className="rounded-lg bg-[#07152f] p-4">
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="mt-2 text-xl font-bold">
                    {(metrics[key] * 100).toFixed(2)}%
                  </p>
                </div>
              ))}
          </div>

          {metrics.threshold !== undefined && (
            <p className="mt-4 text-sm text-slate-300">
              Classification threshold: {metrics.threshold}
            </p>
          )}

          {model.limitations && model.limitations.length > 0 && (
            <div className="mt-5">
              <h4 className="font-semibold text-amber-300">
                Known limitations
              </h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                {model.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function StatusCard({
  title,
  value,
  detail,
  healthy,
}: {
  title: string;
  value: string;
  detail: string;
  healthy: boolean;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#102344] p-6">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <div className="mt-4 flex items-center gap-3">
        <span
          className={`h-3 w-3 rounded-full ${
            healthy ? "bg-emerald-400" : "bg-amber-400"
          }`}
        />
        <h2 className="text-xl font-bold">{value}</h2>
      </div>
      <p className="mt-3 text-sm text-slate-400">{detail}</p>
    </section>
  );
}

export default function AdminMonitoringPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [monitoring, setMonitoring] = useState<MonitoringHealth | null>(null);
  const [modelMonitoring, setModelMonitoring] = useState<ModelMonitoring | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState("");

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");

    try {
      const [healthResponse, monitoringResponse] = await Promise.all([
        fetch(`${API}/api/health`, {
          credentials: "include",
          cache: "no-store",
          signal,
        }),
        fetch(`${API}/api/admin/monitoring/health`, {
          credentials: "include",
          cache: "no-store",
          signal,
        }),
      ]);

      if (!healthResponse.ok) {
        throw new Error(`Backend health HTTP ${healthResponse.status}`);
      }

      if (!monitoringResponse.ok) {
        throw new Error(
          `Admin monitoring HTTP ${monitoringResponse.status}. ` +
          "Verify your administrator session and local backend."
        );
      }

      const publicHealth: Health = await healthResponse.json();
      const adminHealth: MonitoringHealth = await monitoringResponse.json();

      if (!signal?.aborted) {
        setHealth(publicHealth);
        setMonitoring(adminHealth);
        try {
          const modelsResponse = await fetch(
            `${API}/api/admin/monitoring/models`,
            { credentials: "include", cache: "no-store", signal }
          );
          if (modelsResponse.ok) {
            const modelsData: ModelMonitoring = await modelsResponse.json();
            if (!signal?.aborted) setModelMonitoring(modelsData);
          } else {
            setModelMonitoring(null);
          }
        } catch {
          if (!signal?.aborted) setModelMonitoring(null);
        }
        setUpdated(new Date().toLocaleString());
      }
    } catch (err) {
      if (!signal?.aborted) {
        setError(
          err instanceof Error ? err.message : "Monitoring request failed."
        );
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const checks = monitoring?.checks;

  return (
    <main className="fg-admin-page">
      <div className="mx-auto max-w-6xl space-y-8 px-6">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-sky-400">
              FlightGuard AI Enterprise
            </p>
            <h1 className="mt-3 text-4xl font-bold">Platform Monitoring</h1>
            <p className="mt-4 text-slate-300">
              Live system health and infrastructure connectivity.
            </p>
          </div>

          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-lg bg-sky-600 px-5 py-3 font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {loading ? "Checking..." : "Refresh Health"}
          </button>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 p-5 text-red-200">
            {error}
          </div>
        )}

        {loading && !health && (
          <p className="text-slate-300">Checking platform health...</p>
        )}

        {health && monitoring && checks && (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <StatusCard
                title="Backend API"
                value={health.status === "healthy" ? "Online" : "Degraded"}
                detail={health.service}
                healthy={health.status === "healthy"}
              />

              <StatusCard
                title="Historical Dataset"
                value={checks.historical_dataset.available ? "Available" : "Unavailable"}
                detail={
                  checks.historical_dataset.detail +
                  (checks.historical_dataset.size_mb !== undefined
                    ? ` · ${checks.historical_dataset.size_mb} MB`
                    : "")
                }
                healthy={checks.historical_dataset.available}
              />

              <StatusCard
                title="Authentication Database"
                value={checks.authentication_database.available ? "Healthy" : "Unavailable"}
                detail={checks.authentication_database.detail}
                healthy={checks.authentication_database.available}
              />

              <StatusCard
                title="Historical Flights Database"
                value={checks.historical_flights_database.available ? "Healthy" : "Unavailable"}
                detail={checks.historical_flights_database.detail}
                healthy={checks.historical_flights_database.available}
              />

              <StatusCard
                title="Airline Operations Database"
                value={checks.airline_operations_database.available ? "Healthy" : "Unavailable"}
                detail={checks.airline_operations_database.detail}
                healthy={checks.airline_operations_database.available}
              />

              <StatusCard
                title="Ollama Service"
                value={health.llm_connected ? "Connected" : "Disconnected"}
                detail="Local AI inference service"
                healthy={health.llm_connected}
              />

              <StatusCard
                title="AI Model"
                value={health.llm_model_available ? "Available" : "Unavailable"}
                detail={health.llm_model}
                healthy={health.llm_model_available}
              />

              <StatusCard
                title="AI Configuration"
                value={health.llm_configured ? "Configured" : "Not Configured"}
                detail={`Provider: ${health.llm_provider}`}
                healthy={health.llm_configured}
              />
            </div>

            <section className="rounded-xl border border-white/10 bg-[#102344] p-7">
              <h2 className="text-xl font-bold">Monitoring Details</h2>
              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <p>Last refreshed: {updated}</p>
                <p>Backend service: {monitoring.service}</p>
                <p>Data source health: {monitoring.status}</p>
                <p>Backend checked at: {monitoring.checked_at}</p>
                <p>AI provider: {health.llm_provider}</p>
                <p>Configured model: {health.llm_model}</p>
              </div>
            </section>
          </>
        )}

        {modelMonitoring && (
          <section className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold">
                Historical AI Model Evaluation
              </h2>
              <p className="mt-2 text-slate-300">
                Verified saved research metrics, not live production accuracy.
              </p>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <HistoricalModelCard model={modelMonitoring.models.departure_delay} />
              <HistoricalModelCard model={modelMonitoring.models.cancellation} />
            </div>
            <p className="text-sm text-amber-300">
              {modelMonitoring.notice}
            </p>
          </section>
        )}

        <section className="rounded-xl border border-white/10 bg-[#102344] p-7">
          <h2 className="text-xl font-bold">Advanced Monitoring</h2>
          <p className="mt-3 text-slate-300">
            Prediction evaluation, model drift detection, audit history,
            and operational alerting are planned capabilities.
            No synthetic monitoring metrics are displayed.
          </p>
        </section>

        <Link href="/admin" className="inline-block text-sky-400 hover:text-sky-300">
          ← Back to Admin Dashboard
        </Link>
      </div>
    </main>
  );
}
