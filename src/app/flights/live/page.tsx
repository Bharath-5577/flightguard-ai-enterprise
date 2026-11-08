"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Aircraft = {
  icao24: string;
  callsign: string;
  longitude: number;
  latitude: number;
  altitude_m: number | null;
  velocity_ms: number | null;
  heading_deg: number | null;
  on_ground: boolean;
  origin_country?: string;
  demo_origin?: string;
  demo_destination?: string;
  position_time?: number | null;
};

type AircraftResponse = {
  status: string;
  source: string;
  is_live: boolean;
  observed_at: string | null;
  retrieved_at: string;
  notice: string;
  count: number;
  aircraft: Aircraft[];
};

const MAP_STYLE = {
  version: 8 as const,
  sources: {
    "osm": {
      type: "raster" as const,
      tiles: [
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    },
  },
  layers: [
    {
      id: "osm-layer",
      type: "raster" as const,
      source: "osm",
    },
  ],
};

export default function LiveAircraftTracker() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [source, setSource] = useState<"demo" | "opensky">("opensky");
  const [data, setData] = useState<AircraftResponse | null>(null);
  const [selected, setSelected] = useState<Aircraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState("");
  const [search, setSearch] = useState("");
  const [flightStatus, setFlightStatus] = useState("all");
  const [altitudeFilter, setAltitudeFilter] = useState("all");
  const [clockNow, setClockNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setClockNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const ageSeconds = (timestamp: string | number | null | undefined) => {
    if (clockNow === null || timestamp == null) return null;
    const milliseconds = typeof timestamp === "number"
      ? timestamp * 1000
      : Date.parse(timestamp);
    if (!Number.isFinite(milliseconds)) return null;
    return Math.max(0, Math.floor((clockNow - milliseconds) / 1000));
  };

  const freshnessLabel = (age: number | null) =>
    age === null ? "Unavailable" :
    age <= 60 ? "Fresh" :
    age <= 180 ? "Delayed" : "Stale";

  const formatAge = (age: number | null) =>
    age === null ? "Not available" :
    age < 60 ? `${age} sec` :
    age < 3600 ? `${Math.floor(age / 60)} min ${age % 60} sec` :
    `${Math.floor(age / 3600)} hr ${Math.floor((age % 3600) / 60)} min`;

  const observationAge = data?.is_live
    ? ageSeconds(data.observed_at) : null;
  const retrievalAge = data?.is_live
    ? ageSeconds(data.retrieved_at) : null;
  const selectedPositionAge = data?.is_live
    ? ageSeconds(selected?.position_time) : null;

  const aircraft = data?.aircraft || [];
  const airborneCount = aircraft.filter((item) => !item.on_ground).length;
  const groundCount = aircraft.filter((item) => item.on_ground).length;
  const unknownAltitudeCount = aircraft.filter(
    (item) => item.altitude_m == null
  ).length;

  const filteredAircraft = aircraft.filter((item) => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      !query ||
      item.callsign.toLowerCase().includes(query) ||
      item.icao24.toLowerCase().includes(query);

    const matchesStatus =
      flightStatus === "all" ||
      (flightStatus === "airborne" && !item.on_ground) ||
      (flightStatus === "ground" && item.on_ground);

    const matchesAltitude =
      altitudeFilter === "all" ||
      (altitudeFilter === "low" && item.altitude_m != null && item.altitude_m < 3000) ||
      (altitudeFilter === "medium" && item.altitude_m != null &&
        item.altitude_m >= 3000 && item.altitude_m < 9000) ||
      (altitudeFilter === "high" && item.altitude_m != null && item.altitude_m >= 9000) ||
      (altitudeFilter === "unknown" && item.altitude_m == null);

    return matchesSearch && matchesStatus && matchesAltitude;
  });

  const loadAircraft = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API}/api/live/aircraft?source=${source}&limit=100`,
        { cache: "no-store", signal }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Unable to retrieve aircraft data."
        );
      }

      if (signal?.aborted) return;

      setData(result);
      setSelected((previous) =>
        result.aircraft.find(
          (aircraft: Aircraft) => aircraft.icao24 === previous?.icao24
        ) || result.aircraft[0] || null
      );
    } catch (err) {
      if (signal?.aborted) return;
      setData(null);
      setSelected(null);
      setError(
        err instanceof Error ? err.message : "Aircraft request failed."
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    const controller = new AbortController();
    let refreshing = false;

    const refresh = async () => {
      if (document.visibilityState !== "visible" || refreshing) return;
      refreshing = true;
      try {
        await loadAircraft(controller.signal);
      } finally {
        refreshing = false;
      }
    };

    void refresh();

    const interval = window.setInterval(() => {
      if (source === "opensky") {
        void refresh();
      }
    }, 60000);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [loadAircraft, source]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: [-97, 38],
      zoom: 3.4,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right"
    );

    map.on("error", (event) => {
      const message = event.error?.message || "Unknown map error";
      console.error("[FlightGuard MapLibre]", event.error);
      setMapError(`Map warning: ${message}`);
    });

    map.on("idle", () => {
      if (map.isStyleLoaded() && map.areTilesLoaded()) {
        setMapError("");
      }
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    for (const aircraft of filteredAircraft) {
      if (
        !Number.isFinite(aircraft.latitude) ||
        !Number.isFinite(aircraft.longitude)
      ) continue;

      const element = document.createElement("button");
      element.type = "button";
      element.title = aircraft.callsign || aircraft.icao24;
      element.setAttribute(
        "aria-label",
        `Select aircraft ${aircraft.callsign || aircraft.icao24}`
      );
      element.textContent = "✈";
      element.style.fontSize = "24px";
      element.style.color =
        aircraft.icao24 === selected?.icao24 ? "#facc15" : "#38bdf8";
      element.style.background = "transparent";
      element.style.border = "none";
      element.style.cursor = "pointer";
      element.style.transform = `rotate(${aircraft.heading_deg ?? 0}deg)`;

      element.addEventListener("click", () => {
        setSelected(aircraft);
      });

      const marker = new maplibregl.Marker({ element })
        .setLngLat([aircraft.longitude, aircraft.latitude])
        .addTo(map);

      markersRef.current.push(marker);
    }
  }, [data, selected, filteredAircraft]);

  function focusAircraft(aircraft: Aircraft) {
    setSelected(aircraft);
    mapRef.current?.flyTo({
      center: [aircraft.longitude, aircraft.latitude],
      zoom: 6,
      essential: true,
    });
  }

  function formatValue(value: number | null | undefined, unit: string) {
    return typeof value === "number"
      ? `${value.toLocaleString()} ${unit}`
      : "Not available";
  }

  return (
    <main className="min-h-screen bg-[#07152f] p-5 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-widest text-sky-400">
              FLIGHTGUARD AI
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              Aircraft Tracking Center
            </h1>
            <p className="mt-2 text-slate-400">
              Interactive aircraft position monitoring
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Flight Analytics
          </Link>
        </header>

        <section className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-slate-700 bg-[#102344] p-4">
          <label className="text-sm font-medium" htmlFor="aircraft-source">
            Data Source
          </label>
          <select
            id="aircraft-source"
            value={source}
            onChange={(event) =>
              setSource(event.target.value as "demo" | "opensky")
            }
            className="rounded-lg border border-slate-600 bg-[#07152f] px-4 py-2"
          >
            <option value="demo">Synthetic aircraft — interface testing</option>
            <option value="opensky">OpenSky — authorized research</option>
          </select>

          <button
            type="button"
            onClick={() => void loadAircraft()}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-2 font-semibold hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh Aircraft"}
          </button>

          <span className="text-sm text-slate-300">
            Aircraft: {data?.count ?? "—"}
          </span>
        </section>

        <div className="mt-4 rounded-lg border border-amber-800/60 bg-amber-950/30 p-4 text-sm text-amber-200">
          {data?.notice ||
            (source === "demo"
              ? "Synthetic aircraft positions. Not live flight data."
              : "OpenSky requires authorized research access.")}
        </div>

        <section
            id="flightguard-freshness-panel"
            className="mt-4 rounded-xl border border-slate-700 bg-[#102344] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Aircraft Data Freshness</h2>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
                !data?.is_live
                  ? "bg-slate-700 text-slate-200"
                  : observationAge !== null && observationAge <= 60
                    ? "bg-emerald-900/50 text-emerald-300"
                    : observationAge !== null && observationAge <= 180
                      ? "bg-amber-900/50 text-amber-300"
                      : "bg-red-900/50 text-red-300"
              }`}>
                {data?.is_live
                  ? freshnessLabel(observationAge)
                  : "Synthetic / no live observations"}
              </span>
            </div>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-slate-400">Observation age</p>
                <p className="mt-1 font-semibold">{formatAge(observationAge)}</p>
              </div>
              <div>
                <p className="text-slate-400">Time since retrieval</p>
                <p className="mt-1 font-semibold">{formatAge(retrievalAge)}</p>
              </div>
              <div>
                <p className="text-slate-400">Last retrieved (UTC)</p>
                <p className="mt-1 font-semibold">
                  {data?.is_live && data.retrieved_at
                    ? new Date(data.retrieved_at).toLocaleString("en-US", {
                        timeZone: "UTC",
                        hour12: false,
                      })
                    : "Not applicable"}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Fresh: 0–60 sec · Delayed: 61–180 sec · Stale: over 180 sec.
              Individual aircraft positions may be older.
            </p>
          </section>

          {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-900/30 p-4 text-red-300">
            {error}
          </p>
        )}

          <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Observed aircraft", aircraft.length],
              ["Airborne", airborneCount],
              ["On ground", groundCount],
              ["Altitude unavailable", unknownAltitudeCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-700 bg-[#102344] p-4">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-bold">{value}</p>
              </div>
            ))}
          </section>

          <section className="mt-4 grid gap-3 rounded-xl border border-slate-700 bg-[#102344] p-4 md:grid-cols-3">
            <div>
              <label htmlFor="aircraft-search" className="mb-2 block text-sm">
                Search aircraft
              </label>
              <input
                id="aircraft-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Callsign or ICAO24"
                className="w-full rounded-lg border border-slate-600 bg-[#07152f] px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="flight-status" className="mb-2 block text-sm">
                Flight status
              </label>
              <select
                id="flight-status"
                value={flightStatus}
                onChange={(event) => setFlightStatus(event.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-[#07152f] px-3 py-2"
              >
                <option value="all">All aircraft</option>
                <option value="airborne">Airborne</option>
                <option value="ground">On ground</option>
              </select>
            </div>
            <div>
              <label htmlFor="altitude-filter" className="mb-2 block text-sm">
                Altitude
              </label>
              <select
                id="altitude-filter"
                value={altitudeFilter}
                onChange={(event) => setAltitudeFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-[#07152f] px-3 py-2"
              >
                <option value="all">All altitudes</option>
                <option value="low">Below 3,000 m</option>
                <option value="medium">3,000–8,999 m</option>
                <option value="high">9,000 m and above</option>
                <option value="unknown">Altitude unavailable</option>
              </select>
            </div>
          </section>

          <p className="mt-3 text-sm text-slate-400">
            Showing {filteredAircraft.length} of {aircraft.length} aircraft.
            Statistics describe the retrieved sample, not all air traffic.
          </p>


        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <section className="overflow-hidden rounded-xl border border-slate-700 bg-[#102344]">
            <div
              ref={mapContainer}
              className="h-[500px] w-full md:h-[620px]"
              aria-label="Aircraft positions map"
            />
            {mapError && (
              <p className="p-3 text-sm text-amber-300">{mapError}</p>
            )}
          </section>

          <aside className="space-y-5">
            <div className="rounded-xl border border-slate-700 bg-[#102344] p-5">
              <h2 className="text-xl font-semibold">Aircraft Details</h2>
              {selected ? (
                <div className="mt-5 space-y-3 text-sm">
                  <p><span className="text-slate-400">Callsign:</span> {selected.callsign || "Unavailable"}</p>
                  <p><span className="text-slate-400">ICAO24:</span> {selected.icao24}</p>
                  <p><span className="text-slate-400">Country:</span> {selected.origin_country || "Unavailable"}</p>
                  <p><span className="text-slate-400">Latitude:</span> {selected.latitude}</p>
                  <p><span className="text-slate-400">Longitude:</span> {selected.longitude}</p>
                  <p><span className="text-slate-400">Altitude:</span> {formatValue(selected.altitude_m, "m")}</p>
                  <p><span className="text-slate-400">Speed:</span> {formatValue(selected.velocity_ms, "m/s")}</p>
                  <p><span className="text-slate-400">Heading:</span> {formatValue(selected.heading_deg, "°")}</p>
                  <p><span className="text-slate-400">On ground:</span> {selected.on_ground ? "Yes" : "No"}</p>
                    {data?.is_live && (
                      <p>
                        <span className="text-slate-400">Position freshness:</span>{" "}
                        <span className={
                          selectedPositionAge !== null && selectedPositionAge <= 60
                            ? "text-emerald-300"
                            : selectedPositionAge !== null && selectedPositionAge <= 180
                              ? "text-amber-300"
                              : "text-red-300"
                        }>
                          {freshnessLabel(selectedPositionAge)}
                        </span>
                        {" · "}{formatAge(selectedPositionAge)} old
                      </p>
                    )}
                  {data?.source === "synthetic_demo" && (
                    <p className="text-amber-300">
                      Synthetic route: {selected.demo_origin} → {selected.demo_destination}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => focusAircraft(selected)}
                    className="mt-3 rounded-lg bg-blue-600 px-4 py-2 font-medium"
                  >
                    Focus on Map
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-slate-400">
                  Select an aircraft to view its available information.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-700 bg-[#102344] p-5">
              <h2 className="text-lg font-semibold">Aircraft List</h2>
              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                {filteredAircraft.map((aircraft) => (
                  <button
                    key={aircraft.icao24}
                    type="button"
                    onClick={() => focusAircraft(aircraft)}
                    className={`w-full rounded-lg border p-3 text-left text-sm ${
                      selected?.icao24 === aircraft.icao24
                        ? "border-sky-400 bg-sky-900/30"
                        : "border-slate-700 bg-[#07152f]"
                    }`}
                  >
                    <span className="font-semibold">
                      {aircraft.callsign || aircraft.icao24}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">
                      {aircraft.origin_country || "Unknown"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          Source: {data?.source || "Unavailable"} ·
          Observed: {data?.observed_at || "Not applicable"} ·
          Retrieved: {data?.retrieved_at || "Not available"}
        </p>
      </div>
    </main>
  );
}
