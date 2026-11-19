"""Administrator-only platform health monitoring."""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Cookie, Request

from backend.auth import DB_PATH
from backend.flight_store import DB_FILE, CSV_FILE
from backend.registration_admin import require_admin

router = APIRouter(
    prefix="/api/admin/monitoring",
    tags=["Platform Monitoring"],
)

ROOT = Path(__file__).resolve().parents[1]


def check_database(path: Path, required_table: str):
    path = Path(path).resolve()

    if not path.is_file():
        return {"available": False, "detail": "Database file missing"}

    try:
        uri = path.as_uri() + "?mode=ro"

        with sqlite3.connect(uri, uri=True, timeout=5) as db:
            db.execute("PRAGMA query_only=ON")

            result = db.execute("PRAGMA quick_check").fetchone()

            table = db.execute(
                "SELECT name FROM sqlite_master "
                "WHERE type='table' AND name=?",
                (required_table,),
            ).fetchone()

        healthy = bool(
            result and result[0] == "ok" and table
        )

        return {
            "available": healthy,
            "detail": "Integrity verified" if healthy else "Integrity or schema check failed",
        }

    except sqlite3.Error:
        return {
            "available": False,
            "detail": "Database check failed",
        }


def check_dataset():
    path = Path(CSV_FILE)

    if not path.is_file():
        return {
            "available": False,
            "detail": "Dataset file missing",
        }

    try:
        with path.open("rb") as source:
            readable = bool(source.read(1))

        return {
            "available": readable,
            "detail": "Dataset readable" if readable else "Dataset empty",
            "size_mb": round(path.stat().st_size / 1048576, 2),
        }

    except OSError:
        return {
            "available": False,
            "detail": "Dataset not readable",
        }



def read_historical_metrics(filename: str, section: str | None = None):
    """Read existing historical evaluation reports without modifying them."""
    import json
    import math

    models_dir = ROOT.parent / "FlightGuard_AI_Download_Kit" / "models"
    path = models_dir / filename

    if not path.is_file():
        return {
            "available": False,
            "report": filename,
            "detail": "Historical evaluation report unavailable",
        }

    try:
        with path.open("r", encoding="utf-8") as source:
            report = json.load(source)

        if not isinstance(report, dict):
            raise ValueError("Invalid report format")

        metrics = report.get(section) if section else report

        if not isinstance(metrics, dict):
            raise ValueError("Evaluation section unavailable")

        permitted = (
            "threshold", "accuracy", "precision", "recall",
            "f1", "roc_auc", "pr_auc", "brier_score",
            "flights", "cancellations", "base_rate",
        )

        values = {}

        for key in permitted:
            value = metrics.get(key)

            if (
                isinstance(value, (int, float))
                and not isinstance(value, bool)
                and math.isfinite(value)
            ):
                values[key] = value

        if not values:
            raise ValueError("No valid evaluation metrics")

        if section and "threshold" not in values:
            threshold = report.get("threshold")
            if (
                isinstance(threshold, (int, float))
                and not isinstance(threshold, bool)
                and math.isfinite(threshold)
            ):
                values["threshold"] = threshold

        return {
            "available": True,
            "report": filename,
            "evaluation_section": section or "unspecified",
            "metrics": values,
            "limitations": report.get("limitations", [])
                if isinstance(report.get("limitations", []), list)
                else [],
        }

    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return {
            "available": False,
            "report": filename,
            "detail": "Historical evaluation report could not be read",
        }


@router.get("/models")
def historical_model_evaluation(
    request: Request,
    flightguard_session: str | None = Cookie(default=None),
):
    require_admin(request, flightguard_session)

    delay = read_historical_metrics(
        "catboost_validated_metrics.json"
    )

    cancellation = read_historical_metrics(
        "operational_cancellation_weather_full_year_experiment_metrics.json",
        "test",
    )

    return {
        "evaluation_type": "historical_saved_reports",
        "live_evaluation": False,
        "operationally_validated": False,
        "models": {
            "departure_delay": {
                "name": "CatBoost Validated Delay",
                "scope": "Historical JFK departure-delay research",
                "evaluation_split": "Not specified in saved report",
                **delay,
            },
            "cancellation": {
                "name": "CatBoost Weather-Enhanced Cancellation",
                "scope": "Historical 2015 cancellation research",
                "evaluation_split": "Historical test set",
                **cancellation,
            },
        },
        "notice": (
            "These are previously saved historical evaluation metrics. "
            "They are not live prediction accuracy, drift measurements, "
            "or evidence of production readiness."
        ),
    }


@router.get("/health")
def platform_health(
    request: Request,
    flightguard_session: str | None = Cookie(default=None),
):
    require_admin(request, flightguard_session)

    auth = check_database(Path(DB_PATH), "users")
    flights = check_database(Path(DB_FILE), "flights")
    operations = check_database(
        ROOT / "data" / "airline_operations.sqlite3",
        "operational_flights",
    )
    dataset = check_dataset()

    checks = {
        "authentication_database": auth,
        "historical_flights_database": flights,
        "airline_operations_database": operations,
        "historical_dataset": dataset,
    }

    healthy = all(item["available"] for item in checks.values())

    return {
        "status": "healthy" if healthy else "degraded",
        "service": "flightguard-backend",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
    }
