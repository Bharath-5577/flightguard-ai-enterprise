"""Historical 2015 flight cancellation research inference.

Not validated for live aviation forecasting.
"""

from functools import lru_cache
from pathlib import Path
import math

import pandas as pd
from catboost import CatBoostClassifier


ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = (
    ROOT / "FlightGuard_AI_Download_Kit" / "models"
    / "operational_cancellation_weather_full_year_experiment.cbm"
)

CATEGORICAL = ("Reporting_Airline", "Origin", "Dest")

NUMERIC = (
    "Distance",
    "departure_hour",
    "departure_minute",
    "arrival_hour",
    "day_of_week",
    "day_of_month",
    "month",
    "TMP",
    "WND",
    "VIS",
)

FEATURES = CATEGORICAL + NUMERIC


@lru_cache(maxsize=1)
def load_model():
    if not MODEL_PATH.is_file():
        raise RuntimeError("Cancellation model unavailable")

    model = CatBoostClassifier()
    model.load_model(str(MODEL_PATH))

    if list(model.feature_names_) != list(FEATURES):
        raise RuntimeError("Cancellation model feature mismatch")

    return model


def predict_cancellation_risk(features: dict) -> dict:
    if not isinstance(features, dict):
        raise ValueError("Features must be a JSON object")

    missing = set(FEATURES) - set(features)
    extra = set(features) - set(FEATURES)

    if missing or extra:
        raise ValueError(
            f"Missing: {sorted(missing)}; unexpected: {sorted(extra)}"
        )

    clean = {}

    for name in CATEGORICAL:
        value = features[name]
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{name} must be a nonempty string")
        clean[name] = value.strip().upper()

    for name in NUMERIC:
        value = features[name]
        if isinstance(value, bool):
            raise ValueError(f"{name} must be numeric")
        try:
            number = float(value)
        except (TypeError, ValueError, OverflowError) as exc:
            raise ValueError(f"{name} must be numeric") from exc
        if not math.isfinite(number):
            raise ValueError(f"{name} must be finite")
        clean[name] = number

    ranges = {
        "departure_hour": (0, 23),
        "departure_minute": (0, 59),
        "arrival_hour": (0, 23),
        "day_of_week": (0, 6),
        "day_of_month": (1, 31),
        "month": (1, 12),
    }

    for name, (minimum, maximum) in ranges.items():
        value = clean[name]
        if not value.is_integer() or not minimum <= value <= maximum:
            raise ValueError(f"{name} must be an integer from {minimum} to {maximum}")

    if clean["Distance"] <= 0:
        raise ValueError("Distance must be positive")

    model = load_model()
    frame = pd.DataFrame([clean], columns=FEATURES)

    score = float(model.predict_proba(frame)[0, 1])

    if not math.isfinite(score):
        raise RuntimeError("Invalid model score")

    return {
        "model": "catboost_cancellation_weather_2015",
        "target": "flight_cancellation",
        "risk_score": score,
        "risk_score_percent": round(score * 100, 2),
        "historical_research": True,
        "calibrated_probability": False,
        "live_forecast": False,
        "notice": (
            "Historical 2015 research score only. "
            "NOAA publication latency and probability calibration "
            "have not been validated for live forecasting."
        ),
    }
