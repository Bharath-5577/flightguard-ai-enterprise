"""2025 historical flight cancellation research inference.

Model scores are not calibrated probabilities or live forecasts.
"""

from functools import lru_cache
from pathlib import Path
import math

import joblib
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "research_2025/results/cancellation_gradient_boosting_2025.joblib"

CATEGORICAL = ("Reporting_Airline", "Origin", "Dest")

NUMERIC = (
    "Distance",
    "CRSElapsedTime",
    "ScheduledHour",
    "Month",
    "DayOfWeek",
    "tmpf",
    "dwpf",
    "sknt",
    "vsby",
    "mslp",
    "p01i",
)

FEATURES = CATEGORICAL + NUMERIC


@lru_cache(maxsize=1)
def load_model():
    if not MODEL_PATH.is_file():
        raise RuntimeError("2025 cancellation model unavailable")

    model = joblib.load(MODEL_PATH)

    if list(getattr(model, "feature_names_in_", [])) != list(FEATURES):
        raise RuntimeError("2025 cancellation model feature mismatch")

    if not hasattr(model, "predict_proba"):
        raise RuntimeError("2025 cancellation model does not support scoring")

    return model


def predict_cancellation_risk_2025(features: dict) -> dict:
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
        "ScheduledHour": (0, 23),
        "Month": (1, 12),
        "DayOfWeek": (0, 6),
    }

    for name, (minimum, maximum) in ranges.items():
        value = clean[name]
        if not value.is_integer() or not minimum <= value <= maximum:
            raise ValueError(
                f"{name} must be an integer from {minimum} to {maximum}"
            )

    if clean["Distance"] <= 0:
        raise ValueError("Distance must be positive")

    if clean["CRSElapsedTime"] <= 0:
        raise ValueError("CRSElapsedTime must be positive")

    if clean["sknt"] < 0 or clean["vsby"] < 0 or clean["p01i"] < 0:
        raise ValueError("Wind, visibility and precipitation cannot be negative")

    model = load_model()
    frame = pd.DataFrame([clean], columns=FEATURES)

    score = float(model.predict_proba(frame)[0, 1])

    if not math.isfinite(score) or not 0 <= score <= 1:
        raise RuntimeError("Invalid 2025 cancellation model score")

    return {
        "model": "hist_gradient_boosting_cancellation_2025",
        "target": "flight_cancellation",
        "risk_score": score,
        "risk_score_percent": round(score * 100, 2),
        "historical_research": True,
        "calibrated_probability": False,
        "live_forecast": False,
        "notice": (
            "2025 historical research model score only. "
            "Test ROC-AUC was 0.6177. Scores are not calibrated "
            "cancellation probabilities and are not validated "
            "for live flight forecasting."
        ),
    }
