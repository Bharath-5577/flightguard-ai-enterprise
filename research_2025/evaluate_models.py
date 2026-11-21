"""Reproduce saved November–December 2025 model evaluation metrics."""

from pathlib import Path
import json

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "processed" / "weather_enriched"
RESULTS = ROOT / "results"


def evaluate(task):
    print(f"\n========== {task.upper()} ==========", flush=True)

    model = joblib.load(
        RESULTS / f"{task}_gradient_boosting_2025.joblib"
    )

    with (RESULTS / f"{task}_final_test_metrics.json").open() as file:
        saved = json.load(file)

    target = "Delay15" if task == "delay" else "Cancelled"
    threshold = float(saved["threshold"])

    frames = []
    for month in (11, 12):
        path = DATA / f"{task}_test_{month:02d}.parquet"
        df = pd.read_parquet(path)

        if "weather_matched" not in df.columns:
            raise ValueError(f"Missing weather_matched in {path}")

        frames.append(df.loc[df["weather_matched"].fillna(False)])

    test = pd.concat(frames, ignore_index=True)

    X = test[list(model.feature_names_in_)]
    y = test[target].astype(int).to_numpy()

    probabilities = model.predict_proba(X)[:, 1]
    predictions = (probabilities >= threshold).astype(int)

    tn, fp, fn, tp = confusion_matrix(
        y, predictions, labels=[0, 1]
    ).ravel()

    actual = {
        "test_rows": len(y),
        "positive_rate": float(np.mean(y)),
        "roc_auc": roc_auc_score(y, probabilities),
        "pr_auc": average_precision_score(y, probabilities),
        "precision": precision_score(y, predictions, zero_division=0),
        "recall": recall_score(y, predictions, zero_division=0),
        "f1": f1_score(y, predictions, zero_division=0),
        "balanced_accuracy": balanced_accuracy_score(y, predictions),
        "tn": int(tn),
        "fp": int(fp),
        "fn": int(fn),
        "tp": int(tp),
    }

    passed = True

    for metric, value in actual.items():
        expected = saved[metric]
        matches = bool(
            np.isclose(value, expected, atol=1e-8, rtol=1e-8)
        )
        passed = passed and matches

        print(
            f"{metric:20s} "
            f"actual={value:.8f} "
            f"saved={expected:.8f} "
            f"{'PASS' if matches else 'MISMATCH'}"
        )

    if not passed:
        raise RuntimeError(f"{task} evaluation does not match saved metrics")

    print(f"PASS: {task} final-test metrics reproduced", flush=True)


if __name__ == "__main__":
    evaluate("delay")
    evaluate("cancellation")
    print("\nPASS: All final-test metrics reproduced")
