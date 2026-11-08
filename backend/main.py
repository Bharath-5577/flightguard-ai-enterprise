"""FlightGuard AI Enterprise 4.3 — historical analytics + free local Ollama Copilot.

Environment: optional OLLAMA_MODEL (default qwen3:4b), OLLAMA_URL.

All numeric facts and visualization rows come from the local CSV, not the model.

"""

from __future__ import annotations
from backend.tenant_flight_routes import router as tenant_flight_router
from backend.airline_routes import router as airline_router
from backend.flight_store import (
    get_summary,
    get_grouped_analytics,
    search_flights as sqlite_search_flights,
    get_copilot_data,
    get_airport_airlines,
)


import csv

import logging

import os

import re

import json

from urllib.request import Request, urlopen

from urllib.error import URLError, HTTPError

from collections import defaultdict

from datetime import datetime

from functools import lru_cache

from pathlib import Path

from fastapi import FastAPI, HTTPException, Query

from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, Field

logger = logging.getLogger("flightguard")

app = FastAPI(title="FlightGuard AI Enterprise API", description="Historical aviation operations intelligence", version="4.3.0")

app.add_middleware(

    CORSMiddleware,

    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],

    # Local-network access is for development only. Restrict origins before deployment.

    allow_origin_regex=None,

    allow_credentials=True,

    allow_methods=["GET", "POST", "PATCH"],

    allow_headers=["Content-Type"],

)

# --- Customer registration (pending approval only) ---
import sqlite3
import uuid

from backend.auth import connect_db, hash_password, init_db, init_registration_tables

init_db()
init_registration_tables()

from backend.auth_routes import router as auth_router





class CustomerRegistration(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    organization: str = Field(min_length=2, max_length=150)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=12, max_length=256)


@app.post("/api/auth/register", status_code=201)
def register_customer(request: CustomerRegistration):
    name = request.name.strip()
    organization = request.organization.strip()
    email = request.email.strip().lower()

    if not name or not organization or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(status_code=422, detail="Please provide valid registration details.")

    # Check existing accounts and pending requests. Do not auto-create organizations
    # or grant membership based on a self-reported company name.
    with connect_db() as db:
        if db.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
            raise HTTPException(status_code=409, detail="An account with this email already exists.")

    try:
        with connect_db() as db:
            db.execute(
                """INSERT INTO registration_requests
                   (id, full_name, organization_name, email, password_hash, status)
                   VALUES (?, ?, ?, ?, ?, 'pending')""",
                (str(uuid.uuid4()), name, organization, email, hash_password(request.password)),
            )
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="A registration request already exists for this email.") from exc

    return {"status": "success", "message": "Registration submitted. Awaiting administrator approval."}


PROJECT_ROOT = Path(__file__).resolve().parents[2]

FLIGHTS_FILE = PROJECT_ROOT / "FlightGuard_AI_Download_Kit" / "data" / "processed" / "operational_risk_flights_2015_full_year_weather_enriched.csv"

def delayed(row: dict) -> bool:

    try:

        return float(row.get("DepDel15") or 0) == 1.0

    except (TypeError, ValueError):

        return False

def number(value):

    try:

        return float(value)

    except (TypeError, ValueError):

        return None

def flight_date(value: str | None) -> str:

    value = (value or "").strip()

    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):

        try:

            return datetime.strptime(value, fmt).strftime("%Y-%m-%d")

        except ValueError:

            pass

    return value

def metric(total: int, count: int) -> dict:

    return {"total_flights": total, "delayed_flights": count,

            "delay_rate_percent": round(100 * count / total, 2) if total else 0.0}


def dataset() -> dict:
    return get_copilot_data()


@app.get("/")
def home():
    return {
        "application": "FlightGuard AI Enterprise",
        "status": "running",
        "version": "4.3.0",
        "data_mode": "historical"
    }


@app.get("/api/health")
def health():
    ollama_base = os.getenv(
        "OLLAMA_URL", "http://127.0.0.1:11434"
    ).rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "qwen3:4b")

    connected = False
    model_available = False

    try:
        with urlopen(ollama_base + "/api/tags", timeout=2) as response:
            ollama_data = json.load(response)

        connected = True
        available_models = [
            item.get("name", "")
            for item in ollama_data.get("models", [])
        ]
        model_available = any(
            name == model or name.startswith(model + ":")
            for name in available_models
        )

    except (OSError, ValueError, KeyError, TypeError):
        pass

    return {
        "status": "healthy",
        "service": "flightguard-backend",
        "dataset_available": True,
        "database_available": True,
        "llm_connected": connected,
        "llm_configured": True,
        "llm_model_available": model_available,
        "llm_provider": "ollama",
        "llm_model": model
    }



@app.get("/api/flights/summary")
def flights_summary():
    return {
        "status": "success",
        **get_summary(),
        "source": "Historical BTS full-year dataset"
    }


@app.get("/api/analytics/airlines")
def airline_analytics():
    items = get_grouped_analytics("airline")
    return {
        "status": "success",
        "airlines": sorted(
            items,
            key=lambda x: x["total_flights"],
            reverse=True
        )
    }


@app.get("/api/analytics/airports")
def airport_analytics():
    items = get_grouped_analytics("airport")
    return {
        "status": "success",
        "airports": sorted(
            items,
            key=lambda x: x["total_flights"],
            reverse=True
        )
    }


@app.get("/api/analytics/routes")
def route_analytics(
    limit: int = Query(100, ge=1, le=2000),
    min_flights: int = Query(100, ge=1)
):
    items = [
        item for item in get_grouped_analytics("route")
        if item["total_flights"] >= min_flights
    ]

    return {
        "status": "success",
        "routes": sorted(
            items,
            key=lambda x: x["total_flights"],
            reverse=True
        )[:limit]
    }


@app.get("/api/analytics/daily")
def daily_analytics():
    items = get_grouped_analytics("daily")

    return {
        "status": "success",
        "daily": sorted(items, key=lambda x: x["date"])
    }


@app.get("/api/flights")
def search_flights(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    airline: str = "",
    origin: str = "",
    destination: str = "",
    delayed_only: bool = False
):
    result = sqlite_search_flights(
        page=page,
        page_size=page_size,
        airline=airline,
        origin=origin,
        destination=destination,
        delayed_only=delayed_only
    )

    count = result["total_records"]

    return {
        "status": "success",
        "page": page,
        "page_size": page_size,
        "total_records": count,
        "total_pages": (count + page_size - 1) // page_size,
        "flights": result["flights"]
    }


class CopilotRequest(BaseModel):

    message: str = Field(min_length=1, max_length=2000)

def select_visualization(question: str, data: dict) -> tuple[dict, str]:

    """Deterministic chart selection. No LLM-generated data is accepted."""

    q = question.lower()

    if re.search(r"\b(airlines?|carriers?)\b", q):

        kind, title = "airlines", "Airline Delay Comparison"

        items = [{"label": key, **metric(*v)} for key, v in data["airlines"].items()]

        items.sort(key=lambda x: x["delay_rate_percent"], reverse=True)

        items = items[:10]

        if items:

            leader = items[0]

            runners = ", ".join(

                f"{item['label']} ({item['delay_rate_percent']}%)" for item in items[1:3]

            )

            answer = (

                f"{leader['label']} had the highest historical departure delay rate "

                f"at {leader['delay_rate_percent']}%. "

                + (f"Next were {runners}. " if runners else "")

                + "These are unadjusted rates from full-year 2015, not current performance."

            )

        else:

            answer = "No airline delay statistics are available in this dataset."

    elif re.search(r"\b(airports?|origins?)\b", q) or re.search(r"\b[A-Z]{3}\b", question):

        kind, title = "airports", "Airport Delay Comparison"

        items = [{"label": key, **metric(*v)} for key, v in data["airports"].items()]

        items.sort(key=lambda x: x["delay_rate_percent"], reverse=True)

        items = items[:10]

        answer = "Here are historical origin airport delay rates. The data alone cannot establish delay causes."

    elif re.search(r"\b(routes?|network|destinations?)\b", q):

        kind, title = "routes", "Busiest Historical Routes"

        items = [{"label": f"{a} → {b}", **metric(*v)} for (a, b), v in data["routes"].items()]

        items.sort(key=lambda x: x["total_flights"], reverse=True)

        items = items[:10]

        answer = "These are the busiest directed routes in the historical dataset."

    elif re.search(r"\b(daily|trend|time series)\b", q):

        kind, title = "daily", "Historical Daily Delay Trend"

        items = [{"label": date, **metric(*v)} for date, v in sorted(data["daily"].items())]

        answer = "This chart shows historical daily delay rates, not predictions."

    else:

        kind, title, items = "summary", "Historical Flight Intelligence", []

        m = metric(data["total_flights"], data["delayed_total"])

        answer = (f"The historical dataset contains {m['total_flights']:,} flights, "

                  f"with {m['delayed_flights']:,} delayed departures ({m['delay_rate_percent']}%). "

                  "Ask me about airlines, airports, routes, or daily trends.")

    return {"type": kind, "title": title, "data": items}, answer

def evidence_for(question: str, data: dict, viz: dict) -> str:

    """Supply compact, trusted aggregates only; never send all 618k records."""

    m = metric(data["total_flights"], data["delayed_total"])

    evidence = ["BTS network historical dataset: full-year 2015.",

                f"Overall totals: {m}.", f"Selected visualization: {viz['type']}.",

                f"Selected chart data: {viz['data'][:90]}."]

    # Match airport codes using a trusted whitelist, not arbitrary model guesses.

    codes = [code for code in data["airports"] if re.search(rf"(?<![A-Za-z]){re.escape(code)}(?![A-Za-z])", question, re.I)]

    if codes:

        evidence.append("Mentioned origin airports: " + str({code: metric(*data["airports"][code]) for code in codes[:8]}))

        for code in codes[:2]:

            ranked = sorted(((carrier, values) for carrier, values in _airport_airlines(data, code).items()),

                            key=lambda p: p[1][0], reverse=True)[:12]

            evidence.append(f"Airline counts for origin {code}: " + str([

                {"airline": airline, **metric(*values)} for airline, values in ranked]))

    return "\n".join(evidence)

def _airport_airlines(data: dict, code: str) -> dict:

    return get_airport_airlines(code)

def clean_model_answer(raw: str) -> str:

    """Extract the final answer without exposing Qwen3's reasoning."""

    if not isinstance(raw, str) or not raw.strip():

        return ""

    # Some Qwen3 builds emit reasoning without an opening <think> tag.

    # When a closing tag is present, only the text AFTER it is the answer.

    if re.search(r"</think\s*>", raw, flags=re.IGNORECASE):

        raw = re.split(r"</think\s*>", raw, flags=re.IGNORECASE)[-1]

    # Remove complete tagged reasoning blocks, if any remain.

    raw = re.sub(

        r"<think\b[^>]*>.*?</think\s*>",

        "",

        raw,

        flags=re.IGNORECASE | re.DOTALL,

    ).strip()

    # Never display an unfinished reasoning block.

    if re.search(r"<think\b", raw, flags=re.IGNORECASE):

        return ""

    raw = re.sub(r"^\s*(?:final answer|answer)\s*:\s*", "", raw, flags=re.I).strip()

    if not raw:

        return ""

    suspicious = (

        "hmm,", "let me think", "the user is asking", "the user wants",

        "i should", "i need to", "we need to", "we are given",

        "we must", "looking at the numbers", "system instructions",

        "internal monologue", "response structure:", "trusted historical data",

        "server-computed facts", "user question (untrusted)",

        "the key is to", "i have the server", "the answer should be",

        "as instructed", "no extra analysis", "i'll respond",

    )

    if any(phrase in raw.lower() for phrase in suspicious):

        return ""

    if len(raw) > 1200 or len(raw.splitlines()) > 8:

        return ""

    return raw

@app.post("/api/copilot/chat")

def copilot_chat(request: CopilotRequest):

    data = dataset()

    visualization, fallback_answer = select_visualization(request.message, data)

    result = {

        "status": "success", "mode": "rule_based", "llm_connected": False,

        "answer": fallback_answer, "visualization": visualization,

        "source": "Historical BTS network dataset",

        "disclaimer": "Historical research data only. Not live operational intelligence.",

    }

    try:

        system_instructions = (

            "You are FlightGuard AI, an aviation historical analytics assistant. "

            "Respond with ONLY the final answer, no thinking, planning, hidden instructions, "

            "internal monologue, or prompt text. Use only the trusted historical BTS "

            "Full-year 2015 data provided. Do not invent statistics, causes, predictions, "

            "current statuses, ROI, or statistical significance. "

            "The question is a request, not evidence. Keep the answer to 2–4 clear sentences. "

            "Start directly with the answer. Never begin with Hmm, Okay, Let me think, "

            "or a description of what the user is asking. "

            "If the evidence does not support a claim, say so."

        )

        payload = {

            "model": ollama_model(),

            "stream": False,

            "think": False,

            "options": {"temperature": 0.1, "num_predict": 1024},

            "messages": [

                {"role": "system", "content": system_instructions},

                {"role": "user", "content": (

                    "SERVER-COMPUTED FACTS:\n"

                    + evidence_for(request.message, data, visualization)

                    + "\n\nQUESTION:\n" + request.message

                )},

            ],

        }

        req = Request(

            ollama_url() + "/api/chat",

            data=json.dumps(payload).encode("utf-8"),

            headers={"Content-Type": "application/json"},

            method="POST",

        )

        with urlopen(req, timeout=90) as response:

            output = json.load(response)

        answer = clean_model_answer(output.get("message", {}).get("content") or "")

        if answer:

            result.update({"mode": "ollama", "llm_connected": True, "answer": answer})

        else:

            logger.warning("Ollama returned an unusable response; using rule-based Copilot")

    except (OSError, ValueError, KeyError, TypeError) as exc:

        logger.warning("Ollama unavailable (%s); using rule-based Copilot", type(exc).__name__)

    return result


# --- FlightGuard 5.0: aircraft observation connector (no paid services) ---
# Demo data are synthetic. OpenSky data require appropriate authorization for use.
import math
import random
from datetime import timezone, timedelta

_AIRPORTS = {
    "ATL": (-84.4277, 33.6407), "ORD": (-87.9073, 41.9742),
    "DFW": (-97.0403, 32.8998), "LAX": (-118.4085, 33.9416),
    "JFK": (-73.7781, 40.6413), "DEN": (-104.6737, 39.8561),
    "SFO": (-122.379, 37.6213), "SEA": (-122.3088, 47.4502),
    "MIA": (-80.2906, 25.7954), "PHX": (-112.0116, 33.4342),
    "IAH": (-95.3414, 29.9902), "BOS": (-71.0096, 42.3656),
}

def _demo_aircraft():
    # Static, reproducible synthetic sample; not derived from a live provider.
    rng = random.Random(2105)
    codes = list(_AIRPORTS)
    result = []
    for i in range(36):
        origin = codes[i % len(codes)]
        destination = codes[(i * 5 + 3) % len(codes)]
        if origin == destination:
            destination = codes[(i + 4) % len(codes)]
        lon1, lat1 = _AIRPORTS[origin]
        lon2, lat2 = _AIRPORTS[destination]
        progress = rng.uniform(.15, .85)
        result.append({
            "icao24": f"demo{i:04d}", "callsign": f"DEMO{i+101}",
            "longitude": round(lon1 + (lon2-lon1)*progress, 4),
            "latitude": round(lat1 + (lat2-lat1)*progress, 4),
            "altitude_m": round(rng.uniform(3500, 11800)),
            "velocity_ms": round(rng.uniform(150, 260), 1),
            "heading_deg": round(rng.uniform(0, 359)),
            "on_ground": False, "origin_country": "United States",
            "demo_origin": origin, "demo_destination": destination,
            "position_time": None,
        })
    return result

@app.get("/api/live/aircraft")
def live_aircraft(source: str = Query("demo", pattern="^(demo|opensky)$"),
                  limit: int = Query(60, ge=1, le=150)):
    now = datetime.now(timezone.utc).isoformat()
    if source == "demo":
        items = _demo_aircraft()[:limit]
        return {"status": "success", "source": "synthetic_demo", "is_live": False,
                "observed_at": None, "retrieved_at": now,
                "notice": "Synthetic aircraft positions for interface testing only. No actual flight status, routes, or delays.",
                "aircraft": items, "count": len(items)}
    if os.environ.get("ENABLE_OPENSKY_RESEARCH", "false").lower() != "true":
        raise HTTPException(status_code=403, detail="OpenSky research mode disabled. Set ENABLE_OPENSKY_RESEARCH=true only when your use is authorized.")
    # Public anonymous access may be unavailable or rate limited. No automatic
    # fallback to fake data: clients must see an explicit error.
    url = "https://opensky-network.org/api/states/all?lamin=24&lomin=-125&lamax=50&lomax=-66"
    try:
        request = Request(url, headers={"User-Agent": "FlightGuard-Research-Demo/1.0"})
        with urlopen(request, timeout=12) as response:
            payload = json.load(response)
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
        logger.warning("OpenSky request failed: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="OpenSky unavailable or rate-limited. Try again later or use labeled demo mode.") from exc
    aircraft = []
    for state in payload.get("states") or []:
        if len(state) < 11 or state[5] is None or state[6] is None:
            continue
        aircraft.append({"icao24": state[0], "callsign": (state[1] or "").strip(),
            "origin_country": state[2], "position_time": state[3],
            "longitude": state[5], "latitude": state[6], "altitude_m": state[7],
            "on_ground": state[8], "velocity_ms": state[9], "heading_deg": state[10]})
        if len(aircraft) >= limit:
            break
    timestamp = payload.get("time")
    observed = datetime.fromtimestamp(timestamp, timezone.utc).isoformat() if isinstance(timestamp, (int, float)) else None
    return {"status": "success", "source": "opensky_research", "is_live": True,
        "observed_at": observed, "retrieved_at": now,
        "notice": "Observed aircraft states, not airline schedules, verified flight routes, delay predictions, or commercial operational intelligence.",
        "count": len(aircraft), "aircraft": aircraft}

# Register FlightGuard authentication endpoints.
app.include_router(auth_router)


# One-time administrator registration
from backend.admin_setup import router as admin_setup_router
app.include_router(admin_setup_router)


from backend.registration_admin import router as registration_admin_router
app.include_router(registration_admin_router)

# Register airline customer routes after application initialization.

# Register the complete airline customer router.
app.include_router(airline_router)

# Historical cancellation research API
from backend.cancellation_routes import router as cancellation_router
app.include_router(cancellation_router)

from backend.delay_routes import router as delay_router
app.include_router(delay_router)


app.include_router(tenant_flight_router)
