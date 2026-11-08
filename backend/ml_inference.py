"""Historical JFK departure-delay research inference.

Uses the validated CatBoost artifact. Not a live aviation forecast.
Run using FlightGuard_AI_Download_Kit/.venv-ml/bin/python.
"""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

import pandas as pd
from catboost import CatBoostClassifier


ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "FlightGuard_AI_Download_Kit" / "models"

NUMERIC_FEATURES = (
    "Distance",
    "departure_hour",
    "departure_day_of_week",
    "departure_month",
    "departure_is_weekend",
    "temperature_c",
    "wind_speed_ms",
    "visibility_m",
    "precipitation_mm",
    "weather_age_minutes",
)

CATEGORICAL_FEATURES = ("Reporting_Airline", "Dest")
EXPECTED_FEATURES = set(NUMERIC_FEATURES + CATEGORICAL_FEATURES)


@lru_cache(maxsize=1)
def load_model():
    model = CatBoostClassifier()
    model.load_model(str(MODEL_DIR / "catboost_validated.cbm"))

    with open(
        MODEL_DIR / "catboost_validated_metrics.json",
        encoding="utf-8",
    ) as file:
        metrics = json.load(file)

    threshold = float(metrics["threshold"])

    if not math.isfinite(threshold) or not 0 <= threshold <= 1:
        raise ValueError("Invalid saved classification threshold")

    if set(model.feature_names_) != EXPECTED_FEATURES:
        raise ValueError("Model feature schema does not match")

    return model, threshold


def predict_delay_risk(features: dict) -> dict:
    """Score one explicitly supplied historical research scenario."""

    if not isinstance(features, dict):
        raise ValueError("Features must be a JSON object")

    missing = EXPECTED_FEATURES - features.keys()
    extra = features.keys() - EXPECTED_FEATURES

    if missing or extra:
        raise ValueError(
            f"Feature mismatch. Missing: {sorted(missing)}; "
            f"Unexpected: {sorted(extra)}"
        )

    clean = {}

    for name in NUMERIC_FEATURES:
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

    for name in CATEGORICAL_FEATURES:
        value = features[name]

        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{name} must be a nonempty string")

        clean[name] = value.strip()

    if not 0 <= clean["departure_hour"] <= 23:
        raise ValueError("departure_hour must be between 0 and 23")

    if not 0 <= clean["departure_day_of_week"] <= 6:
        raise ValueError("departure_day_of_week must be between 0 and 6")

    if not 1 <= clean["departure_month"] <= 12:
        raise ValueError("departure_month must be between 1 and 12")

    for name in (
        "departure_hour",
        "departure_day_of_week",
        "departure_month",
        "departure_is_weekend",
    ):
        if not clean[name].is_integer():
            raise ValueError(f"{name} must be an integer")

    weekday = int(clean["departure_day_of_week"])

    if clean["departure_is_weekend"] != int(weekday >= 5):
        raise ValueError("Weekend flag does not match weekday")

    for name in (
        "Distance",
        "wind_speed_ms",
        "visibility_m",
        "precipitation_mm",
        "weather_age_minutes",
    ):
        if clean[name] < 0:
            raise ValueError(f"{name} cannot be negative")

    model, threshold = load_model()

    frame = pd.DataFrame([clean])
    frame = frame[model.feature_names_]

    score = float(model.predict_proba(frame)[0, 1])

    if not math.isfinite(score):
        raise RuntimeError("Model returned a non-finite score")

    return {
        "model": "catboost_validated",
        "model_score": score,
        "classification_threshold": threshold,
        "elevated_delay_risk": score >= threshold,
        "target": "departure_delay_at_least_15_minutes",
        "training_scope": "historical_JFK_departures",
        "calibrated_probability": False,
        "live_forecast": False,
        "notice": (
            "Historical JFK research model. Score is not a "
            "calibrated operational probability or live forecast."
        ),
    }
