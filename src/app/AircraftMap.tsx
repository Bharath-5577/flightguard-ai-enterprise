"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type Aircraft = {
  icao24?: string;
  callsign?: string;
  latitude: number;
  longitude: number;
  altitude_m?: number | null;
  velocity_ms?: number | null;
  heading_deg?: number | null;
  on_ground?: boolean;
};

export default function AircraftMap({ aircraft }: { aircraft: Aircraft[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
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
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: [-98, 39],
      zoom: 3,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    for (const plane of aircraft) {
      if (
        !Number.isFinite(plane.latitude) ||
        !Number.isFinite(plane.longitude) ||
        Math.abs(plane.latitude) > 90 ||
        Math.abs(plane.longitude) > 180
      ) continue;

      const element = document.createElement("div");
      element.textContent = "✈";
      element.style.fontSize = "25px";
      element.style.cursor = "pointer";
      element.style.color = plane.on_ground ? "#fbbf24" : "#46e0ee";
      element.style.textShadow = "0 1px 3px #0b1724";

      const popup = new maplibregl.Popup({ offset: 18 }).setText(
        [
          `Flight: ${plane.callsign || "Unknown"}`,
          `ICAO24: ${plane.icao24 || "N/A"}`,
          `Altitude: ${plane.altitude_m ?? "N/A"} m`,
          `Speed: ${plane.velocity_ms == null ? "N/A" : Math.round(plane.velocity_ms * 3.6) + " km/h"}`,
          `On ground: ${plane.on_ground ? "Yes" : "No"}`,
        ].join("\n")
      );

      markersRef.current.push(
        new maplibregl.Marker({ element })
          .setLngLat([plane.longitude, plane.latitude])
          .setPopup(popup)
          .addTo(map)
      );
    }
  }, [aircraft]);

  return (
    <div className="w-full">
      <div ref={containerRef} className="h-[440px] w-full overflow-hidden rounded-xl" />
      <p className="mt-2 text-xs text-slate-400">
        Aircraft positions reflect the selected source. Synthetic demo positions are not live tracking.
      </p>
    </div>
  );
}
