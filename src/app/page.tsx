"use client";



import { useEffect, useMemo, useState } from "react";
import AircraftMap from "./AircraftMap";



type View = "operations" | "live" | "flights" | "airports" | "financial" | "reports" | "settings";



type Aircraft = { icao24: string; callsign: string; longitude: number; latitude: number; altitude_m: number | null; velocity_ms: number | null; heading_deg: number | null; on_ground: boolean; origin_country: string; demo_origin?: string; demo_destination?: string };

type AircraftResponse = { status: string; source: string; is_live: boolean; observed_at: string | null; retrieved_at: string; notice: string; count: number; aircraft: Aircraft[] };



type Summary = { status: string; total_flights: number; delayed_flights: number; delay_rate_percent: number; origin_airports: number; source?: string };



type Performance = { total_flights: number; delayed_flights: number; delay_rate_percent: number; airline?: string; airport?: string };



type Route = Performance & { origin: string; destination: string };



type Daily = { date: string; delay_rate_percent: number; total_flights?: number };



type Flight = { date: string; airline: string; origin: string; destination: string; scheduled_departure: string; departure_delay_minutes: string | number; delayed_15_minutes: boolean };



type FlightResults = { flights: Flight[]; total_records: number; total_pages: number; page: number };



type Message = { id: number; role: "user" | "assistant"; content: string };



type ChartMode = "airlines" | "airports" | "routes";



type CopilotResponse = {



  status: string;



  answer: string;



  mode: string;



  llm_connected?: boolean;



  visualization: {



    type: "airlines" | "airports" | "routes" | "daily" | "summary";



    title: string;



    data: {label: string; total_flights: number; delayed_flights: number; delay_rate_percent: number}[];



  };



};



const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";



const nf = (n: number) => n.toLocaleString("en-US");



const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);



const panel = "rounded-2xl border border-[#344358] bg-[#1a2635] shadow-[0_12px_40px_rgba(0,0,0,0.12)]";



const input = "min-w-0 rounded-lg border border-[#39495b] bg-[#121d2a] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400";



const airportCoords: Record<string, [number, number]> = {



  ATL: [-84.4277, 33.6407], JFK: [-73.7781, 40.6413], LAX: [-118.4085, 33.9416], ORD: [-87.9073, 41.9742],



  DFW: [-97.0403, 32.8998], DEN: [-104.6737, 39.8561], SFO: [-122.379, 37.6213], CLT: [-80.9431, 35.2144],



  LAS: [-115.1523, 36.084], PHX: [-112.0116, 33.4342], IAH: [-95.3414, 29.9902], MCO: [-81.3089, 28.4312],



  SEA: [-122.3088, 47.4502], MIA: [-80.2906, 25.7954], BOS: [-71.0096, 42.3656], MSP: [-93.2218, 44.8848],



  DTW: [-83.3534, 42.2162], PHL: [-75.2411, 39.8729], EWR: [-74.1745, 40.6895], BWI: [-76.6684, 39.1754],



  SLC: [-111.9791, 40.7899], SAN: [-117.1897, 32.7338], DCA: [-77.0377, 38.8512], LGA: [-73.874, 40.7769],



  FLL: [-80.1527, 26.0742], MDW: [-87.7524, 41.7868], HNL: [-157.9225, 21.3187], PDX: [-122.5951, 45.5898],



  STL: [-90.37, 38.7487], BNA: [-86.6782, 36.1245], AUS: [-97.6699, 30.1975], RDU: [-78.7875, 35.8776],



};



function geoPoint(code: string): [number, number] | null {



  const p = airportCoords[code];



  if (!p) return null;



  return [78 + ((p[0] + 125) / 59) * 625, 62 + ((49 - p[1]) / 25) * 315];



}



function NetworkMap({ airports, routes, selected, onSelect }: { airports: Performance[]; routes: Route[]; selected: string; onSelect: (s: string) => void }) {



  const [zoom, setZoom] = useState(1);



  const [pan, setPan] = useState<[number,number]>([0,0]);



  const [dragStart, setDragStart] = useState<[number,number] | null>(null);



  const [showRoutes, setShowRoutes] = useState(true);



  const [hovered, setHovered] = useState("");



  const [minTraffic, setMinTraffic] = useState(0);



  const [focusedRoute, setFocusedRoute] = useState<Route | null>(null);



  const [mapSearch, setMapSearch] = useState("");



  const visible = airports.filter(a => a.airport && geoPoint(a.airport));



  const displayedRoutes = routes.filter(r => r.total_flights >= minTraffic && geoPoint(r.origin) && geoPoint(r.destination) && (!selected || r.origin === selected || r.destination === selected)).slice(0, 200);



  const active = airports.find(a => a.airport === selected);



  const focus = selected && zoom > 1 ? (geoPoint(selected) || [400, 225]) : [400, 225];



  const tx = 400 - focus[0] * zoom + pan[0];



  const ty = 225 - focus[1] * zoom + pan[1];



  const reset = () => { setZoom(1); setPan([0,0]); onSelect(""); setHovered(""); setFocusedRoute(null); };



  const focused = airports.find(a => a.airport === hovered) || active;



  return (



    <div className="relative h-[490px] overflow-hidden rounded-xl border border-[#34485c] bg-[#0b1724] xl:h-[545px]">



      <div className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(circle at 40% 40%, #183b50 0%, transparent 60%)" }} />



      <div className="absolute left-3 top-3 z-10 max-w-[65%] rounded-lg border border-[#39566c] bg-[#101e2d]/95 p-3 shadow-xl">



        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">Network intelligence</p>



        <p className="mt-1 text-xs font-semibold text-slate-100">US airport network · Historical departures</p>



        <p className="mt-1 text-[10px] text-slate-400">Airport coordinates projected · Jan–Dec 2015</p>



      </div>



      <div className="absolute left-3 top-[96px] z-10 flex items-center gap-2 rounded-lg border border-[#39566c] bg-[#101e2d]/95 px-2 py-1.5">



        <span className="text-xs text-cyan-300">⌕</span>



        <input aria-label="Find airport on map" placeholder="Find airport code…" value={mapSearch}



          onChange={e => setMapSearch(e.target.value.toUpperCase().slice(0, 4))}



          onKeyDown={e => { if(e.key === "Enter" && airports.some(a => a.airport === mapSearch)) { onSelect(mapSearch); setMapSearch(""); } }}



          className="w-32 bg-transparent text-xs text-white outline-none placeholder:text-slate-500" />



        <button title="Find airport" onClick={() => {if(airports.some(a=>a.airport===mapSearch)){onSelect(mapSearch);setMapSearch("");}}} className="text-xs font-semibold text-cyan-300">GO</button>



      </div>



      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">



        <button aria-label="Zoom in" title="Zoom in" onClick={() => setZoom(z => Math.min(3, +(z + .25).toFixed(2)))} className="rounded-md border border-[#426078] bg-[#17293b] px-3 py-2 text-lg font-bold text-cyan-200 hover:bg-[#26445a]">+</button>



        <button aria-label="Zoom out" title="Zoom out" onClick={() => setZoom(z => Math.max(1, +(z - .25).toFixed(2)))} className="rounded-md border border-[#426078] bg-[#17293b] px-3 py-2 text-lg font-bold text-cyan-200 hover:bg-[#26445a]">−</button>



        <button title="Reset view" onClick={reset} className="rounded-md border border-[#426078] bg-[#17293b] px-2 py-2 text-[10px] text-slate-200 hover:bg-[#26445a]">RESET</button>



      </div>



      <svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid meet" className="h-full w-full touch-none cursor-grab active:cursor-grabbing" role="img" aria-label="Interactive historical US airport route network" onPointerDown={e => { if ((e.target as Element).closest("g[role=button]")) return; e.currentTarget.setPointerCapture(e.pointerId); setDragStart([e.clientX,e.clientY]); }} onPointerMove={e => { if (!dragStart) return; const box=e.currentTarget.getBoundingClientRect(); setPan(old=>[old[0]+(e.clientX-dragStart[0])*800/box.width,old[1]+(e.clientY-dragStart[1])*450/box.height]); setDragStart([e.clientX,e.clientY]); }} onPointerUp={() => setDragStart(null)} onPointerCancel={() => setDragStart(null)}>



        <defs>



          <pattern id="fg-network-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="#274155" strokeWidth=".6" /></pattern>



          <radialGradient id="fg-map-glow"><stop stopColor="#19415a" stopOpacity=".6"/><stop offset="1" stopColor="#0b1724" stopOpacity="0"/></radialGradient>



        </defs>



        <rect width="800" height="450" fill="url(#fg-network-grid)" />



        <circle cx="400" cy="225" r="350" fill="url(#fg-map-glow)" />



        <g transform={`translate(${tx} ${ty}) scale(${zoom})`} style={{transition:"transform .25s ease"}}>



          <path d="M75 100 L125 75 L185 100 L220 93 L300 108 L345 80 L410 100 L450 112 L505 98 L560 125 L650 110 L735 152 L700 190 L735 232 L685 285 L660 350 L600 333 L560 385 L490 340 L430 355 L370 300 L290 310 L240 255 L165 240 L120 200 Z" fill="#172e3f" fillOpacity=".75" stroke="#3d6178" strokeWidth="1.5" />



          {showRoutes && displayedRoutes.map((r,i) => {



            const a = geoPoint(r.origin)!; const b = geoPoint(r.destination)!;



            const midx = (a[0]+b[0])/2; const midy = (a[1]+b[1])/2 - Math.max(8, Math.abs(a[0]-b[0])*.12);



            const strong = Boolean(selected);



            return <path key={`${r.origin}-${r.destination}-${i}`} d={`M${a[0]} ${a[1]} Q${midx} ${midy} ${b[0]} ${b[1]}`} fill="none"



              stroke={focusedRoute?.origin === r.origin && focusedRoute?.destination === r.destination ? "#fbbf24" : strong ? "#53e1f2" : "#478cae"}



              strokeWidth={(focusedRoute?.origin === r.origin && focusedRoute?.destination === r.destination ? 4 : strong ? 2.2 : 1.5)/zoom}



              strokeOpacity={strong ? .85 : .4} className="cursor-pointer"



              onClick={e => {e.stopPropagation();setFocusedRoute(r);}}><title>{`${r.origin} → ${r.destination}: ${nf(r.total_flights)} flights, ${r.delay_rate_percent}% delayed`}</title></path>;



          })}



          {visible.map(a => {



            const code = a.airport!; const p = geoPoint(code)!;



            const chosen = selected === code; const over = hovered === code;



            const radius = Math.max(3.5, Math.min(8, 3 + a.total_flights/20000));



            return <g key={code} role="button" tabIndex={0} aria-label={`Select airport ${code}`} onClick={() => onSelect(chosen ? "" : code)} onKeyDown={e => {if(e.key === "Enter" || e.key === " "){e.preventDefault();onSelect(chosen ? "" : code);}}} onMouseEnter={() => setHovered(code)} onMouseLeave={() => setHovered("")} className="cursor-pointer outline-none">



              <circle cx={p[0]} cy={p[1]} r={chosen ? 19 : over ? 16 : 12} fill={chosen ? "#22d3ee" : "#fbbf24"} opacity={chosen ? .24 : .11}/>



              <circle cx={p[0]} cy={p[1]} r={radius} fill={chosen ? "#40e0f2" : "#f8c86b"} stroke="#0d2030" strokeWidth="2"/>



              <text x={p[0]+9} y={p[1]-10} fill={chosen ? "#73f3ff" : "#e3ebf2"} fontSize="11" fontWeight={chosen ? "800" : "500"} paintOrder="stroke" stroke="#0b1724" strokeWidth="3">{code}</text>



            </g>;



          })}



        </g>



        {!visible.length && <text x="400" y="230" textAnchor="middle" fill="#9bb4c7" fontSize="16">Airport data loading…</text>}



      </svg>



      <div className="absolute bottom-3 left-3 z-10 max-w-[64%] rounded-lg border border-[#3b5368] bg-[#101e2d]/95 px-3 py-2 text-[11px] shadow-lg">



        {focusedRoute ? <><p className="font-bold text-amber-300">{focusedRoute.origin} → {focusedRoute.destination}</p><p className="mt-1 text-slate-200">{nf(focusedRoute.total_flights)} flights · {focusedRoute.delay_rate_percent}% delayed</p><button className="mt-1 text-cyan-300 underline" onClick={() => setFocusedRoute(null)}>Close route details</button></> : focused ? <><p className="font-bold text-cyan-300">{focused.airport} · Airport intelligence</p><p className="mt-1 text-slate-300">{nf(focused.total_flights)} flights · {focused.delay_rate_percent}% delayed</p><p className="mt-1 text-slate-500">{selected ? "Selected airport" : "Hover or click to select"}</p></> : <p className="text-slate-300">Click an airport or drag to pan the network</p>}



      </div>



      <div className="absolute bottom-3 right-3 z-10 flex flex-col items-end gap-2">



        <label className="flex items-center gap-2 rounded-md bg-[#101e2d]/95 px-2 py-1.5 text-[10px] text-slate-300"><input type="checkbox" checked={showRoutes} onChange={e=>setShowRoutes(e.target.checked)} className="accent-cyan-400"/> Routes</label>



        <select aria-label="Minimum flights per route" value={minTraffic} onChange={e=>setMinTraffic(Number(e.target.value))} className="max-w-[115px] rounded-md border border-[#39556a] bg-[#101e2d] px-2 py-1.5 text-[10px] text-slate-200"><option value={0}>All routes</option><option value={250}>250+ flights</option><option value={1000}>1,000+ flights</option></select>



        <p className="rounded-md bg-[#101e2d]/95 px-2 py-1 text-[10px] text-slate-400">{displayedRoutes.length} returned routes · {Math.round(zoom*100)}%</p>



      </div>



    </div>



  );



}



function Trend({ data }: { data: Daily[] }) {



  if (!data.length) return <p className="py-16 text-center text-sm text-slate-400">Daily analytics unavailable</p>;



  const top = Math.max(40, Math.ceil(Math.max(...data.map(d => d.delay_rate_percent)) / 10) * 10);



  const points = data.map((d, i) => `${35 + i * 665 / Math.max(1, data.length - 1)},${10 + (1 - d.delay_rate_percent / top) * 155}`).join(" ");



  return <svg viewBox="0 0 735 195" className="w-full" role="img" aria-label="Historical daily delay rate trend">



    {[0, 1, 2, 3].map(i => <g key={i}><line x1="35" x2="700" y1={10 + i * 51.6} y2={10 + i * 51.6} stroke="#354454"/><text x="2" y={15 + i * 51.6} fill="#91a5b7" fontSize="11">{Math.round(top * (1 - i / 3))}%</text></g>)}



    <polyline points={points} stroke="#44d7e8" strokeWidth="2.5" fill="none" strokeLinejoin="round" />



    <text x="35" y="190" fill="#91a5b7" fontSize="11">{data[0]?.date}</text><text x="700" y="190" textAnchor="end" fill="#91a5b7" fontSize="11">{data[data.length - 1]?.date}</text>



  </svg>;



}



function Rankings({ items, onSelect, selected, metric = "delay" }: { items: { label: string; rate: number; flights: number }[]; onSelect?: (s: string) => void; selected?: string; metric?: "delay" | "volume" }) {



  if (!items.length) return <p className="py-10 text-center text-sm text-slate-400">No analytics available for this selection.</p>;



  return <div className="space-y-3">{items.slice(0, 9).map(item => <button type="button" key={item.label} onClick={() => onSelect?.(item.label)} className={`block w-full rounded-lg px-2 py-2 text-left hover:bg-white/5 ${selected === item.label ? "bg-cyan-400/10" : ""}`}>



    <div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-slate-200">{item.label}</span><span className="text-slate-300">{metric === "delay" ? `${item.rate.toFixed(2)}%` : nf(item.flights)} <span className="ml-2 text-slate-500">{metric === "delay" ? nf(item.flights) + " flights" : item.rate.toFixed(2) + "%"}</span></span></div>



    <div className="h-2 rounded-full bg-[#344252]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-400" style={{width: `${Math.max(0, Math.min(100, (metric === "delay" ? item.rate / 45 : item.flights / Math.max(1,...items.map(i => i.flights))) * 100))}%`}} /></div>



  </button>)}</div>;



}



export default function Home() {



  const [view, setView] = useState<View>("operations");

  const [aircraftSource, setAircraftSource] = useState<"demo" | "opensky">("demo");

  const [aircraftData, setAircraftData] = useState<AircraftResponse | null>(null);

  const [aircraftError, setAircraftError] = useState("");

  const [aircraftBusy, setAircraftBusy] = useState(false);

  const [aircraftSearch, setAircraftSearch] = useState("");

  const [aircraftRefresh, setAircraftRefresh] = useState(0);





  const [summary, setSummary] = useState<Summary | null>(null);



  const [airlines, setAirlines] = useState<Performance[]>([]);



  const [airports, setAirports] = useState<Performance[]>([]);



  const [routes, setRoutes] = useState<Route[]>([]);



  const [daily, setDaily] = useState<Daily[]>([]);



  const [error, setError] = useState("");



  const [selectedAirport, setSelectedAirport] = useState("");



  const selectAirport = (code: string) => { setSelectedAirport(code); setCopilotChart(null); if (code) setChartMode("routes"); };



  const [chartMode, setChartMode] = useState<ChartMode>("airlines");



  const [messages, setMessages] = useState<Message[]>([{id: 1, role: "assistant", content: "Welcome to FlightGuard Operations Intelligence. Ask me to compare airlines, summarize historical delays, or show airport performance. I can also change the analytics view. Responses use local Qwen3 AI when available, with a rule-based fallback."}]);



  const [question, setQuestion] = useState("");



  const [copilotBusy, setCopilotBusy] = useState(false);



  const [llmStatus, setLlmStatus] = useState<"checking" | "connected" | "fallback" | "unavailable">("checking");



  const [llmModel, setLlmModel] = useState("Qwen3");



  const [copilotChart, setCopilotChart] = useState<CopilotResponse["visualization"] | null>(null);



  const [showChat, setShowChat] = useState(true);



  const [focusMode, setFocusMode] = useState(false);



  const [chartMetric, setChartMetric] = useState<"delay" | "volume">("delay");



  const [showInsights, setShowInsights] = useState(true);



  const [mobileNav, setMobileNav] = useState(false);



  const [flightFilter, setFlightFilter] = useState({ airline: "", origin: "", destination: "", delayed: false, page: 1 });



  const [flightData, setFlightData] = useState<FlightResults | null>(null);



  const [flightError, setFlightError] = useState("");



  const [financial, setFinancial] = useState({ flights: 100, probability: 30, minutes: 45, cost: 100, reduction: 15 });



  useEffect(() => {



    let active = true;



    fetch(`${API}/api/health`, { cache: "no-store" })



      .then(response => { if (!response.ok) throw new Error("Health check failed"); return response.json(); })



      .then(health => {



        if (!active) return;



        if (health.llm_model) setLlmModel(String(health.llm_model));



        setLlmStatus(health.llm_connected === true ? "connected" : "fallback");



      })



      .catch(() => { if (active) setLlmStatus("unavailable"); });



    return () => { active = false; };



  }, []);



  useEffect(() => {



    let active = true;



    const load = async () => {



      try {



        const endpoints = ["/api/flights/summary", "/api/analytics/airlines", "/api/analytics/airports", "/api/analytics/routes?limit=100&min_flights=100", "/api/analytics/daily"];



        const results = await Promise.allSettled(endpoints.map(async path => {



          const r = await fetch(`${API}${path}`); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json();



        }));



        if (!active) return;



        if (results[0].status === "fulfilled" && results[0].value.status === "success") setSummary(results[0].value);



        else setError("Flight summary unavailable. Confirm FastAPI is running on port 8000.");



        if (results[1].status === "fulfilled") setAirlines(results[1].value.airlines ?? []);



        if (results[2].status === "fulfilled") setAirports(results[2].value.airports ?? []);



        if (results[3].status === "fulfilled") setRoutes(results[3].value.routes ?? []);



        if (results[4].status === "fulfilled") setDaily(results[4].value.daily ?? []);



      } catch { if (active) setError("Unable to reach the historical analytics API."); }



    };



    load(); return () => { active = false; };



  }, []);



  useEffect(() => {



    if (view !== "flights") return;



    const controller = new AbortController();



    const params = new URLSearchParams({ page: String(flightFilter.page), page_size: "20" });



    if (flightFilter.airline) params.set("airline", flightFilter.airline);



    if (flightFilter.origin) params.set("origin", flightFilter.origin.toUpperCase());



    if (flightFilter.destination) params.set("destination", flightFilter.destination.toUpperCase());



    if (flightFilter.delayed) params.set("delayed_only", "true");



    fetch(`${API}/api/flights?${params}`, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { if (!controller.signal.aborted) {setFlightData(data); setFlightError("");} }).catch(() => { if (!controller.signal.aborted) setFlightError("Flight record endpoint is unavailable."); });



    return () => controller.abort();



  }, [view, flightFilter]);



  useEffect(() => {

    if (view !== "live") return;

    const controller = new AbortController();

    setAircraftBusy(true);

    setAircraftError("");

    setAircraftData(null);

    fetch(`${API}/api/live/aircraft?source=${aircraftSource}&limit=60`, { signal: controller.signal, cache: "no-store" })

      .then(async r => { if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || `API error ${r.status}`); } return r.json(); })

      .then((data: AircraftResponse) => { if (!controller.signal.aborted) setAircraftData(data); })

      .catch((e: Error) => { if (!controller.signal.aborted) setAircraftError(e.message); })

      .finally(() => { if (!controller.signal.aborted) setAircraftBusy(false); });

    return () => controller.abort();

  }, [view, aircraftSource, aircraftRefresh]);



  const exposure = financial.flights * financial.probability / 100 * financial.minutes * financial.cost;



  const filteredRoutes = useMemo(() => selectedAirport ? routes.filter(r => r.origin === selectedAirport || r.destination === selectedAirport) : routes, [routes, selectedAirport]);



  const networkInsights = useMemo(() => {



    const rankedAirports = [...airports].filter(a => a.total_flights >= 1000).sort((a,b)=>b.delay_rate_percent-a.delay_rate_percent);



    const busy = [...routes].sort((a,b)=>b.total_flights-a.total_flights)[0];



    const selected = airports.find(a => a.airport === selectedAirport);



    return {high: rankedAirports[0], busy, selected};



  }, [airports, routes, selectedAirport]);



  const rankingItems = useMemo(() => {



    if (selectedAirport) return [...filteredRoutes].sort((a,b) => b.total_flights - a.total_flights).slice(0, 12).map(r => ({label: `${r.origin} → ${r.destination}`, rate: r.delay_rate_percent, flights: r.total_flights}));



    if (chartMode === "airports") return [...airports].sort((a,b) => b.delay_rate_percent - a.delay_rate_percent).map(a => ({label: a.airport || "—", rate: a.delay_rate_percent, flights: a.total_flights}));



    if (chartMode === "routes") return [...filteredRoutes].sort((a,b) => b.total_flights - a.total_flights).slice(0, 9).map(r => ({label: `${r.origin} → ${r.destination}`, rate: r.delay_rate_percent, flights: r.total_flights}));



    return [...airlines].sort((a,b) => b.delay_rate_percent - a.delay_rate_percent).map(a => ({label: a.airline || "—", rate: a.delay_rate_percent, flights: a.total_flights}));



  }, [airlines, airports, chartMode, filteredRoutes, selectedAirport]);



  const send = async (prompt?: string) => {



    const q = (prompt ?? question).trim();



    if (!q || copilotBusy) return;



    setQuestion("");



    setMessages(old => [...old, {id: Date.now(), role: "user", content: q}]);



    setCopilotBusy(true);



    try {



      const response = await fetch(`${API}/api/copilot/chat`, {



        method: "POST",



        headers: {"Content-Type": "application/json"},



        body: JSON.stringify({message: q}),



      });



      if (!response.ok) throw new Error(`Copilot API returned ${response.status}`);



      const result: CopilotResponse = await response.json();



      if (result.status !== "success") throw new Error("Copilot returned an unsuccessful result");



    setLlmStatus(result.mode === "ollama" && result.llm_connected === true ? "connected" : "fallback");



      setMessages(old => [...old, {id: Date.now() + 1, role: "assistant", content: result.answer}]);



      const airportMention = airports.find(a => a.airport && new RegExp(`\\b${a.airport}\\b`, "i").test(q));



      if (airportMention?.airport) { selectAirport(airportMention.airport); }



      else { setCopilotChart(result.visualization); }



      if (!airports.some(a => a.airport && new RegExp(`\\b${a.airport}\\b`, "i").test(q)) && ["airlines", "airports", "routes"].includes(result.visualization.type)) {



        setChartMode(result.visualization.type as ChartMode);



      }



    } catch {



      setMessages(old => [...old, {id: Date.now() + 1, role: "assistant", content: "The Copilot API is unavailable. Check that FastAPI is running on port 8000 and try again."}]);



    } finally {



      setCopilotBusy(false);



    }



  };



  const download = (name: string, rows: (string | number)[][]) => {



    const csv = rows.map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\r\n");



    const url = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));



    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);



  };



  const updateFilter = (changes: Partial<typeof flightFilter>) => setFlightFilter(old => ({...old, ...changes, page: changes.page ?? 1}));



  const sections: {view: View; label: string; icon: string}[] = [



    {view:"operations",label:"Operations Intelligence",icon:"◈"},{view:"live",label:"Live Flight Command",icon:"◉"},{view:"flights",label:"Flight Operations",icon:"✈"},{view:"airports",label:"Airport Network",icon:"◎"},



    {view:"financial",label:"Financial Intelligence",icon:"$"},{view:"reports",label:"Reporting Center",icon:"▣"},{view:"settings",label:"Platform Settings",icon:"⚙"}



  ];



  return <div className="min-h-screen bg-[#0c1420] text-[#edf2f8]">



    <div className="flex min-h-screen">



      <aside className={`${mobileNav ? "fixed inset-y-0 left-0 z-50" : "hidden"} w-60 shrink-0 border-r border-[#2e3949] bg-[#151e2b] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col`}>



        <div className="border-b border-[#2e3949] px-5 py-6"><div className="text-lg font-black tracking-tight">✈ FlightGuard <span className="text-cyan-400">AI</span></div><p className="mt-1 text-[10px] tracking-[.22em] text-slate-400">ENTERPRISE OPERATIONS</p></div>



        <div className="flex-1 space-y-2 p-3"><p className="px-3 py-3 text-[10px] font-bold tracking-[.2em] text-slate-500">WORKSPACE</p><a href="/predictions/cancellation" className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-cyan-300 hover:bg-cyan-400/10 hover:text-white"><span className="w-5 text-center text-lg">◈</span>Cancellation Prediction</a><a href="/predictions/delay" className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-cyan-300 hover:bg-cyan-400/10 hover:text-white"><span className="w-5 text-center text-lg">◈</span>Delay Prediction</a>{sections.map(item => <button key={item.view} onClick={() => {setView(item.view);setMobileNav(false);}} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm ${view === item.view ? "border border-cyan-400/25 bg-cyan-400/10 font-semibold text-cyan-300" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><span className="w-5 text-center text-lg">{item.icon}</span>{item.label}</button>)}</div>



        <div className="border-t border-[#2e3949] p-4"><div className="rounded-lg border border-[#38485b] bg-[#1b2939] p-3"><p className="text-xs font-bold">Environment Status</p><p className="mt-3 text-xs text-slate-400"><span className={summary ? "text-emerald-400" : "text-amber-400"}>●</span> {summary ? "Historical API connected" : "API disconnected"}</p><p className="mt-2 text-[11px] text-slate-500">Research data · Jan–Dec 2015</p></div></div>



      </aside>



      {mobileNav && <button className="fixed inset-0 z-40 bg-black/70 lg:hidden" aria-label="Close menu" onClick={() => setMobileNav(false)} />}



      <div className="min-w-0 flex-1">



        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-[#2e3949] bg-[#192331] px-4 md:px-6"><div className="flex items-center gap-3"><button className="rounded-lg border border-white/10 p-2 lg:hidden" onClick={() => setMobileNav(true)}>☰</button><div><p className="text-[11px] text-slate-400">FlightGuard AI / Aviation Intelligence</p><h1 className="text-base font-bold">{sections.find(s => s.view === view)?.label}</h1></div></div><div className="flex items-center gap-3"><span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[10px] font-bold text-amber-300">HISTORICAL DEMO</span><span className="hidden h-9 w-9 items-center justify-center rounded-full bg-[#29445b] text-xs font-bold text-cyan-300 sm:flex">FG</span></div></header>



        {error && <div className="mx-4 mt-4 rounded-lg border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-200">{error}</div>}



        <main className="mx-auto max-w-[2200px] space-y-5 p-4 md:p-6">



          {view === "live" && <>

          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-400">Aircraft observation center</p><h2 className="mt-2 text-3xl font-bold">Flight Command Center</h2><a href="/flights/live" className="mt-4 inline-block rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/20">Open Aircraft Tracking Center →</a><p className="mt-2 text-sm text-slate-400">Aircraft observations and synthetic demonstrations. Not a certified operational flight-dispatch system.</p></div><div className="flex flex-wrap gap-2"><select aria-label="Aircraft data source" className={input} value={aircraftSource} onChange={e => setAircraftSource(e.target.value as "demo" | "opensky")}><option value="demo">Synthetic Demo (free)</option><option value="opensky">OpenSky (authorized research only)</option></select><button className={input} disabled={aircraftBusy} onClick={() => setAircraftRefresh(x => x + 1)}>{aircraftBusy ? "Loading…" : "↻ Refresh observations"}</button></div></div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200"><b>{aircraftSource === "demo" ? "SYNTHETIC DEMO — NOT LIVE" : "RESEARCH OBSERVATIONS — NOT COMMERCIAL FLIGHT STATUS"}</b><p className="mt-1">{aircraftData?.notice || "Select a source and refresh. OpenSky access must be authorized and can be rate-limited."}</p></div>

          {aircraftError && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{aircraftError}</div>}

          <div className="grid gap-4 sm:grid-cols-3">{[["Aircraft in response",aircraftData ? nf(aircraftData.count) : "—"],["Airborne observations",aircraftData ? nf(aircraftData.aircraft.filter(a=>!a.on_ground).length) : "—"],["Data observed",aircraftData?.observed_at ? new Date(aircraftData.observed_at).toLocaleString() : "Not live / unavailable"]].map(([label,value]) => <section key={label} className={`${panel} p-5`}><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-2xl font-bold text-cyan-300">{value}</p></section>)}</div>

         <section className={`${panel} p-5`}>
           <div className="flex flex-wrap items-center justify-between gap-3">
             <h3 className="text-lg font-bold">Interactive Aircraft Tracking Map</h3>
             <p className="text-xs text-slate-400">MapLibre · Zoom · Pan · Click aircraft</p>
           </div>
           <div className="mt-4">
             <AircraftMap aircraft={aircraftData?.aircraft ?? []} />
           </div>
           <p className="mt-3 text-xs text-amber-300">
             {aircraftSource === "demo"
               ? "SYNTHETIC DEMO — NOT LIVE AIRCRAFT POSITIONS"
               : "RESEARCH OBSERVATIONS — NOT VERIFIED COMMERCIAL FLIGHT STATUS"}
           </p>
         </section>

          <section className={`${panel} p-5`}><div className="flex flex-wrap justify-between gap-3"><h3 className="text-lg font-bold">Aircraft Details</h3><input aria-label="Search aircraft" className={input} placeholder="Search callsign or ICAO24" value={aircraftSearch} onChange={e=>setAircraftSearch(e.target.value)}/></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-[#28384b]"><tr>{["Callsign","ICAO24","Latitude","Longitude","Altitude (m)","Speed (km/h)","On ground","Demo route"].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{(aircraftData?.aircraft || []).filter(a=>`${a.callsign} ${a.icao24}`.toLowerCase().includes(aircraftSearch.toLowerCase())).map((a,i)=><tr key={`${a.icao24}-${i}`} className="border-t border-white/10"><td className="p-3 font-semibold text-cyan-300">{a.callsign || "—"}</td><td className="p-3">{a.icao24}</td><td className="p-3">{a.latitude?.toFixed(3)}</td><td className="p-3">{a.longitude?.toFixed(3)}</td><td className="p-3">{a.altitude_m == null ? "—" : Math.round(a.altitude_m).toLocaleString()}</td><td className="p-3">{a.velocity_ms == null ? "—" : Math.round(a.velocity_ms*3.6)}</td><td className="p-3">{a.on_ground ? "Yes" : "No"}</td><td className="p-3">{a.demo_origin ? `${a.demo_origin} → ${a.demo_destination} (synthetic)` : "Not provided"}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-slate-500">Retrieved: {aircraftData?.retrieved_at ? new Date(aircraftData.retrieved_at).toLocaleString() : "—"} · Source: {aircraftData?.source || "—"}</p></section>

        </>}

        {view === "operations" && <>



            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-bold tracking-[.2em] text-cyan-400">MISSION CONTROL / HISTORICAL OPERATIONS</p><h2 className="mt-2 text-2xl font-bold md:text-3xl">Flight Operations Intelligence</h2><p className="mt-2 text-sm text-slate-400">Explore historical flights, investigate network patterns, and compare carrier performance.</p></div><div className="flex gap-2"><button onClick={() => setFocusMode(v => !v)} className={input}>{focusMode ? "Exit focus" : "⛶ Focus workspace"}</button><button onClick={() => setShowChat(v => !v)} className={input}>{showChat ? "Hide" : "Show"} Copilot</button><button onClick={() => setView("reports")} className={input}>↓ Reports</button></div></div>



            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[



              ["TOTAL FLIGHTS",summary ? nf(summary.total_flights) : "—","text-cyan-300"],["DELAYED 15+ MIN",summary ? nf(summary.delayed_flights) : "—","text-amber-300"],["DELAY RATE",summary ? `${summary.delay_rate_percent}%` : "—","text-white"],["ORIGIN AIRPORTS",summary ? nf(summary.origin_airports) : "—","text-emerald-300"]



            ].map(([label,value,color]) => <div key={label} className={`${panel} p-4 md:p-5`}><p className="text-[10px] font-bold tracking-widest text-slate-400">{label}</p><p className={`mt-3 text-2xl font-bold md:text-3xl ${color}`}>{value}</p><p className="mt-2 text-[11px] text-slate-500">BTS · Jan–Dec 2015</p></div>)}</div>



            {showInsights && <div className="grid gap-3 md:grid-cols-3">



              <div className="rounded-xl border border-[#31475b] bg-gradient-to-r from-[#182b3b] to-[#1a2637] p-4"><p className="text-[10px] uppercase tracking-widest text-cyan-300">Highest observed airport delay rate · 1k+ flights</p><p className="mt-2 text-lg font-bold">{networkInsights.high?.airport || "—"} <span className="text-amber-300">{networkInsights.high ? `${networkInsights.high.delay_rate_percent}%` : ""}</span></p></div>



              <div className="rounded-xl border border-[#31475b] bg-gradient-to-r from-[#182b3b] to-[#1a2637] p-4"><p className="text-[10px] uppercase tracking-widest text-cyan-300">Busiest returned route</p><p className="mt-2 text-lg font-bold">{networkInsights.busy ? `${networkInsights.busy.origin} → ${networkInsights.busy.destination}` : "—"} <span className="text-slate-400 text-sm">{networkInsights.busy ? nf(networkInsights.busy.total_flights) : ""}</span></p></div>



              <div className="rounded-xl border border-[#31475b] bg-gradient-to-r from-[#182b3b] to-[#1a2637] p-4"><p className="text-[10px] uppercase tracking-widest text-cyan-300">Active investigation</p><p className="mt-2 text-lg font-bold">{selectedAirport || "Entire historical network"} <span className="text-cyan-300 text-sm">{networkInsights.selected ? `${networkInsights.selected.delay_rate_percent}% delayed` : ""}</span></p></div>



            </div>}



            <div className={`grid gap-4 ${focusMode ? "2xl:grid-cols-[minmax(280px,.85fr)_minmax(440px,1.9fr)_minmax(300px,1fr)]" : showChat ? "xl:grid-cols-[minmax(260px,0.95fr)_minmax(340px,1.6fr)_minmax(260px,1fr)]" : "xl:grid-cols-[minmax(450px,1.6fr)_minmax(300px,1fr)]"}`}>



              {showChat && <section className={`${panel} flex h-[660px] min-h-0 flex-col overflow-hidden`}><div className="flex items-center justify-between border-b border-[#354252] px-4 py-4"><div><h3 className="font-bold">✦ Operations Copilot</h3><p className="mt-1 text-[11px] text-slate-400">Historical analytics assistant</p></div><button onClick={() => setMessages([{id:1,role:"assistant",content:"New conversation. Ask me about historical airline, airport, or route performance."}])} className="rounded-lg border border-[#405063] px-2 py-1.5 text-xs text-slate-300">+ New</button></div>



                <div className="flex-1 space-y-4 overflow-y-auto p-4 xl:max-h-[530px]">{messages.map(m => <div key={m.id} className={`${m.role === "user" ? "ml-6 bg-[#314257]" : "mr-3 bg-[#233246]"} rounded-xl border border-white/5 p-3`}><p className={`mb-2 text-[11px] font-bold ${m.role === "user" ? "text-slate-300" : "text-cyan-300"}`}>{m.role === "user" ? "YOU" : "✦ FLIGHTGUARD COPILOT"}</p><p className="whitespace-pre-wrap text-[13px] leading-6 text-slate-200">{m.content}</p></div>)}</div>



                <div className="space-y-3 border-t border-[#354252] p-4"><div className="flex flex-wrap gap-2">{[{label:"Airlines",q:"Compare airline delay rates"},{label:"Airports",q:"Show airport performance"},{label:"Routes",q:"Show route network"}].map(s => <button key={s.label} onClick={() => send(s.q)} className="rounded-full border border-[#415267] px-3 py-1.5 text-[11px] text-slate-300 hover:border-cyan-400">{s.label}</button>)}</div><form onSubmit={e => {e.preventDefault();send();}} className="flex gap-2"><input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask about flight analytics…" className={`${input} w-full`} /><button disabled={!question.trim() || copilotBusy} className="rounded-lg bg-cyan-400 px-4 font-bold text-[#0b1b28] disabled:opacity-40">↑</button></form><p className="text-[10px] text-slate-500">Backend-powered analytics · {llmStatus === "connected" ? `Local AI connected (${llmModel})` : llmStatus === "fallback" ? "Rule-based fallback · AI unavailable for last check" : llmStatus === "unavailable" ? "AI status unavailable" : "Checking local AI…"} · Historical data</p></div>



                {copilotBusy && <p className="px-4 pb-3 text-xs text-cyan-300">Analyzing historical data...</p>}



              </section>}



              <section className={`${panel} min-w-0 p-3 md:p-4`}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Airport Network</h3><p className="mt-1 text-xs text-slate-400">Click airports or route lines · zoom and pan to investigate</p></div><select value={selectedAirport} onChange={e => selectAirport(e.target.value)} className={input}><option value="">All airports</option>{airports.map(a => <option key={a.airport} value={a.airport}>{a.airport}</option>)}</select></div><NetworkMap airports={airports} routes={routes} selected={selectedAirport} onSelect={selectAirport}/><div className="mt-4 grid grid-cols-3 gap-2">{[["Mapped origins",airports.filter(a => geoPoint(a.airport || "")).length],["Returned routes",routes.length],["Selected routes",filteredRoutes.length]].map(([k,v]) => <div key={String(k)} className="rounded-lg bg-[#253344] p-3"><p className="text-[10px] text-slate-400">{k}</p><p className="mt-1 text-xl font-bold">{v}</p></div>)}</div></section>



              <section className={`${panel} min-w-0 max-h-[660px] overflow-y-auto p-4`}><h3 className="font-bold">Copilot Chart Analysis</h3><p className="mt-1 text-xs text-slate-400">Actual historical delay-rate comparisons</p>{selectedAirport && <div className="mt-3 flex items-center justify-between rounded-lg border border-cyan-700/40 bg-cyan-950/30 px-3 py-2 text-xs"><span className="text-cyan-200">Filtered network: <b>{selectedAirport}</b> · {filteredRoutes.length} returned routes</span><button onClick={() => selectAirport("")} className="text-cyan-300 underline">Clear</button></div>}<div className="mt-5 grid grid-cols-3 gap-1 rounded-lg bg-[#111b28] p-1">{([{key:"airlines",label:"Airlines"},{key:"airports",label:"Airports"},{key:"routes",label:"Routes"}] as {key:ChartMode;label:string}[]).map(t => <button key={t.key} onClick={() => { if (selectedAirport) selectAirport(""); setChartMode(t.key); setCopilotChart(null); }} className={`rounded-md px-2 py-2 text-xs ${chartMode === t.key ? "bg-[#31475e] font-semibold text-cyan-300" : "text-slate-400"}`}>{t.label}</button>)}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] text-slate-400">Compare by</span><div className="flex rounded-lg border border-[#35485c] bg-[#111b28] p-1"><button onClick={() => setChartMetric("delay")} className={`rounded px-3 py-1.5 text-[11px] ${chartMetric === "delay" ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400"}`}>Delay %</button><button onClick={() => setChartMetric("volume")} className={`rounded px-3 py-1.5 text-[11px] ${chartMetric === "volume" ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400"}`}>Flight volume</button></div></div><div className="mt-3 text-[11px] text-cyan-300">{copilotChart ? `API visualization: ${copilotChart.title}` : "Select a chart or ask Copilot to analyze data"}</div><div className="mt-5"><Rankings items={!selectedAirport && copilotChart && copilotChart.type === chartMode && copilotChart.data.length ? copilotChart.data.map(item => ({label:item.label, rate:item.delay_rate_percent, flights:item.total_flights})) : rankingItems} metric={chartMetric} onSelect={chartMode === "airports" ? selectAirport : undefined} selected={selectedAirport}/></div><p className="mt-5 text-[11px] leading-5 text-slate-500">Historical unadjusted rates. Airport selection shows returned routes involving that airport, not airline-level airport performance. Route data is limited to the API response.</p></section>



            </div>



            <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]"><section className={`${panel} p-5`}><h3 className="font-bold">Daily Delay Trend</h3><p className="mb-4 mt-1 text-xs text-slate-400">Actual observed daily delay percentages</p><Trend data={daily}/></section><section className={`${panel} p-5`}><h3 className="font-bold">Model Research Snapshot</h3><p className="mt-5 text-xs uppercase tracking-wider text-slate-400">JFK CatBoost ROC-AUC</p><p className="mt-3 text-4xl font-bold text-cyan-300">0.6831</p><div className="mt-5 h-2 rounded-full bg-[#344252]"><div className="h-full w-[68.31%] rounded-full bg-cyan-400" /></div><p className="mt-5 text-xs leading-6 text-slate-400">Historical research result only. Not validated for live operational decisions.</p></section></div>



          </>}



          {view === "flights" && <><div><h2 className="text-3xl font-bold">Flight Operations</h2><p className="mt-2 text-sm text-slate-400">Search and inspect historical BTS flight records.</p></div><section className={`${panel} p-5`}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><select className={input} value={flightFilter.airline} onChange={e => updateFilter({airline:e.target.value})}><option value="">All airlines</option>{airlines.map(a => <option key={a.airline} value={a.airline}>{a.airline}</option>)}</select><input className={input} placeholder="Origin airport" value={flightFilter.origin} onChange={e => updateFilter({origin:e.target.value})}/><input className={input} placeholder="Destination airport" value={flightFilter.destination} onChange={e => updateFilter({destination:e.target.value})}/><label className={`${input} flex items-center gap-2`}><input type="checkbox" checked={flightFilter.delayed} onChange={e => updateFilter({delayed:e.target.checked})}/> Delayed 15+ minutes</label></div>{flightError && <p className="mt-4 text-sm text-amber-300">{flightError}</p>}<div className="mt-5 overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-[#28384b] text-slate-300"><tr>{["Date","Airline","Origin","Destination","Departure","Delay (min)","Delayed 15+"].map(t => <th key={t} className="p-3">{t}</th>)}</tr></thead><tbody>{(flightData?.flights ?? []).map((f,i) => <tr key={i} className="border-t border-white/10">{[f.date,f.airline,f.origin,f.destination,f.scheduled_departure,f.departure_delay_minutes,f.delayed_15_minutes ? "Yes" : "No"].map((v,j) => <td key={j} className="p-3">{String(v ?? "—")}</td>)}</tr>)}</tbody></table></div><div className="mt-5 flex items-center justify-between"><p className="text-sm text-slate-400">{flightData ? `${nf(flightData.total_records)} records · page ${flightData.page} of ${flightData.total_pages}` : "Loading records…"}</p><div className="flex gap-2"><button className={input} disabled={flightFilter.page <= 1} onClick={() => updateFilter({page:flightFilter.page-1})}>Previous</button><button className={input} disabled={!flightData || flightFilter.page >= flightData.total_pages} onClick={() => updateFilter({page:flightFilter.page+1})}>Next</button></div></div></section><section className={`${panel} p-5`}><h3 className="mb-5 text-lg font-bold">Airline Delay Comparisons</h3><Rankings items={[...airlines].sort((a,b)=>b.total_flights-a.total_flights).map(a=>({label:a.airline||"—",rate:a.delay_rate_percent,flights:a.total_flights}))}/></section></>}



          {view === "airports" && <><h2 className="text-3xl font-bold">Airport Network</h2><div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]"><section className={`${panel} p-4`}><div className="mb-3 flex justify-between gap-3"><h3 className="font-bold">Airport Network View</h3><select className={input} value={selectedAirport} onChange={e => selectAirport(e.target.value)}><option value="">All airports</option>{airports.map(a=><option key={a.airport} value={a.airport}>{a.airport}</option>)}</select></div><NetworkMap airports={airports} routes={routes} selected={selectedAirport} onSelect={selectAirport}/></section><section className={`${panel} p-5`}><h3 className="mb-5 font-bold">Airport Delay Rankings</h3><Rankings items={[...airports].sort((a,b)=>b.delay_rate_percent-a.delay_rate_percent).map(a=>({label:a.airport||"—",rate:a.delay_rate_percent,flights:a.total_flights}))} onSelect={selectAirport} selected={selectedAirport}/></section></div><section className={`${panel} p-5`}><h3 className="mb-4 font-bold">{selectedAirport ? `${selectedAirport} routes` : "Available historical routes"}</h3><div className="max-h-[400px] overflow-auto"><table className="w-full text-left text-sm"><thead className="bg-[#28384b]"><tr><th className="p-3">Origin</th><th className="p-3">Destination</th><th className="p-3">Flights</th><th className="p-3">Delay rate</th></tr></thead><tbody>{filteredRoutes.map((r,i)=><tr key={i} className="border-t border-white/10"><td className="p-3">{r.origin}</td><td className="p-3">{r.destination}</td><td className="p-3">{nf(r.total_flights)}</td><td className="p-3">{r.delay_rate_percent}%</td></tr>)}</tbody></table></div></section></>}



          {view === "financial" && <><div><h2 className="text-3xl font-bold">Financial Intelligence</h2><p className="mt-2 text-sm text-slate-400">Scenario modeling using your own assumptions; not actual airline costs.</p></div><div className="grid gap-4 xl:grid-cols-2"><section className={`${panel} space-y-6 p-6`}><h3 className="text-lg font-bold">Scenario Inputs</h3>{([{key:"flights",label:"Flights",min:10,max:1000,step:10},{key:"probability",label:"Delay probability (%)",min:0,max:100,step:5},{key:"minutes",label:"Delay minutes",min:5,max:180,step:5},{key:"cost",label:"Cost per minute ($)",min:25,max:300,step:5},{key:"reduction",label:"Assumed reduction (%)",min:0,max:50,step:5}] as {key:keyof typeof financial;label:string;min:number;max:number;step:number}[]).map(x=><div key={x.key}><div className="mb-3 flex justify-between text-sm"><span className="text-slate-300">{x.label}</span><b className="text-cyan-300">{financial[x.key]}</b></div><input aria-label={x.label} type="range" className="w-full accent-cyan-400" min={x.min} max={x.max} step={x.step} value={financial[x.key]} onChange={e=>setFinancial(f=>({...f,[x.key]:Number(e.target.value)}))}/></div>)}</section><section className="space-y-4">{[["Estimated exposure",usd(exposure)],["Hypothetical avoided exposure",usd(exposure*financial.reduction/100)],["Remaining exposure",usd(exposure*(1-financial.reduction/100))]].map(([k,v])=><div key={k} className={`${panel} p-6`}><p className="text-sm text-slate-400">{k}</p><p className="mt-4 text-3xl font-bold text-cyan-300">{v}</p></div>)}<p className="text-xs text-amber-300">Illustrative assumptions only; no verified ROI or airline cost model.</p></section></div></>}



          {view === "reports" && <><h2 className="text-3xl font-bold">Reporting Center</h2><div className="grid gap-4 md:grid-cols-2"><section className={`${panel} p-6`}><h3 className="text-lg font-bold">Flight Summary CSV</h3><p className="my-4 text-sm text-slate-400">Download actual historical summary metrics.</p><button disabled={!summary} onClick={()=>summary&&download("flightguard-summary.csv",[["Metric","Value"],["Total flights",summary.total_flights],["Delayed flights",summary.delayed_flights],["Delay rate (%)",summary.delay_rate_percent],["Origin airports",summary.origin_airports]])} className="rounded-lg bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-40">Download Summary</button></section><section className={`${panel} p-6`}><h3 className="text-lg font-bold">Airline Performance CSV</h3><p className="my-4 text-sm text-slate-400">Export airline counts and delay rates.</p><button disabled={!airlines.length} onClick={()=>download("flightguard-airlines.csv",[["Airline","Flights","Delayed","Delay rate (%)"],...airlines.map(a=>[a.airline||"",a.total_flights,a.delayed_flights,a.delay_rate_percent])])} className="rounded-lg bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-40">Download Airlines</button></section></div></>}



          {view === "settings" && <><h2 className="text-3xl font-bold">Platform Settings</h2><section className={`${panel} max-w-3xl p-6`}>{[["Frontend","Next.js"],["Backend","FastAPI"],["API endpoint",API],["Data mode","Historical BTS (Jan–Dec 2015)"],["API status",summary?"Connected":"Unavailable"],["Copilot",llmStatus === "connected" ? "Local AI + rule-based fallback" : "Rule-based historical assistant"],["LLM",llmStatus === "connected" ? `${llmModel} connected` : llmStatus === "fallback" ? "Fallback mode" : llmStatus === "checking" ? "Checking…" : "Status unavailable"],["Live airline feeds","Not connected"],["Authentication","Not configured"]].map(([k,v])=><div key={k} className="flex flex-wrap justify-between gap-3 border-b border-white/10 py-4 text-sm"><span className="text-slate-400">{k}</span><span>{v}</span></div>)}</section></>}



          <footer className="border-t border-[#303b4b] pt-4 text-xs text-slate-500">FlightGuard AI Enterprise · Historical research demonstration · Not for live aviation decisions</footer>



        </main>



      </div>



    </div>



  </div>;



}
