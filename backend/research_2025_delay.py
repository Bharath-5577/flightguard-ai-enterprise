"""Isolated 2025 historical delay research inference."""
from functools import lru_cache
from pathlib import Path
import math
import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "research_2025/results/delay_gradient_boosting_2025.joblib"
THRESHOLD = 0.23011568387881784

FEATURES = [
    "Reporting_Airline", "Origin", "Dest",
    "Distance", "CRSElapsedTime", "ScheduledHour",
    "Month", "DayOfWeek", "tmpf", "dwpf",
    "sknt", "vsby", "mslp", "p01i"
]
CATEGORICAL = {"Reporting_Airline", "Origin", "Dest"}

@lru_cache(maxsize=1)
def load_model():
    model = joblib.load(MODEL_PATH)
    if list(model.feature_names_in_) != FEATURES:
        raise RuntimeError("Research model feature schema mismatch")
    return model

def predict(features: dict) -> dict:
    if not isinstance(features, dict):
        raise ValueError("features must be an object")

    missing = set(FEATURES) - set(features)
    extra = set(features) - set(FEATURES)
    if missing or extra:
        raise ValueError(
            f"Missing: {sorted(missing)}; unexpected: {sorted(extra)}"
        )

    clean = {}
    for name in FEATURES:
        value = features[name]
        if name in CATEGORICAL:
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{name} must be a nonempty string")
            clean[name] = value.strip().upper()
        else:
            if value is None:
                clean[name] = float("nan")
            elif isinstance(value, bool):
                raise ValueError(f"{name} must be numeric")
            else:
                try:
                    number = float(value)
                except (TypeError, ValueError, OverflowError):
                    raise ValueError(f"{name} must be numeric")
                if not (math.isfinite(number) or math.isnan(number)):
                    raise ValueError(f"{name} must be finite or missing")
                clean[name] = number

    if not 0 <= clean["ScheduledHour"] <= 23:
        raise ValueError("ScheduledHour must be between 0 and 23")
    if not 1 <= clean["Month"] <= 12:
        raise ValueError("Month must be between 1 and 12")
    if not 0 <= clean["DayOfWeek"] <= 6:
        raise ValueError("DayOfWeek must be between 0 and 6")
    if clean["Distance"] <= 0:
        raise ValueError("Distance must be positive")
    if clean["CRSElapsedTime"] <= 0:
        raise ValueError("CRSElapsedTime must be positive")

    frame = pd.DataFrame([clean], columns=FEATURES)
    score = float(load_model().predict_proba(frame)[0, 1])
    if not math.isfinite(score):
        raise RuntimeError("Invalid model score")

    return {
        "model": "hist_gradient_boosting_2025",
        "model_score": score,
        "classification_threshold": THRESHOLD,
        "elevated_delay_risk": bool(score >= THRESHOLD),
        "target": "departure_delay_at_least_15_minutes",
        "historical_research": True,
        "calibrated_probability": False,
        "live_forecast": False,
        "notice": "2025 historical research model; not validated for live operational forecasting."
    }
