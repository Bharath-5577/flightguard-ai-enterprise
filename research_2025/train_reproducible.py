"""Reconstructed training experiment; preserves original saved models."""

from pathlib import Path
import argparse
import json

import joblib
import pandas as pd
from sklearn.base import clone
from sklearn.metrics import average_precision_score, roc_auc_score

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "processed" / "weather_enriched"
ORIGINAL = ROOT / "results"
OUTPUT = ROOT / "results" / "reconstructed_training"

SAMPLE_SIZE = 300_000
SEED = 42


def load_split(task, split, months, columns):
    frames = []

    for month in months:
        path = DATA / f"{task}_{split}_{month:02d}.parquet"
        frame = pd.read_parquet(
            path,
            columns=columns + ["weather_matched"],
        )
        frame = frame.loc[
            frame["weather_matched"].fillna(False),
            columns,
        ]
        frames.append(frame)

    return pd.concat(frames, ignore_index=True)


def run(task, kind):
    target = "Delay15" if task == "delay" else "Cancelled"
    source = ORIGINAL / f"{task}_{kind}_2025.joblib"

    template = joblib.load(source)
    features = list(template.feature_names_in_)

    print(f"\nTraining {task} / {kind}", flush=True)

    train = load_split(
        task, "train", range(1, 9), features + [target]
    )

    if len(train) < SAMPLE_SIZE:
        raise ValueError("Insufficient training records")

    # New documented sampling procedure; original selection unknown.
    sample = train.sample(
        n=SAMPLE_SIZE,
        random_state=SEED,
        replace=False,
    )

    del train

    validation = load_split(
        task, "validation", range(9, 11),
        features + [target],
    )

    # Clone unfitted estimator structure and hyperparameters.
    model = clone(template)

    model.fit(sample[features], sample[target].astype(int))

    scores = model.predict_proba(validation[features])[:, 1]
    labels = validation[target].astype(int)

    metrics = {
        "task": task,
        "model": kind,
        "experiment": "reconstructed_training",
        "sampling": "random_without_replacement",
        "random_state": SEED,
        "train_rows": len(sample),
        "validation_rows": len(validation),
        "train_positive_rate": float(sample[target].mean()),
        "validation_positive_rate": float(labels.mean()),
        "roc_auc": float(roc_auc_score(labels, scores)),
        "pr_auc": float(average_precision_score(labels, scores)),
        "original_training_sample_selection": "unknown",
    }

    OUTPUT.mkdir(parents=True, exist_ok=True)

    model_path = OUTPUT / f"{task}_{kind}_retrained.joblib"
    metrics_path = OUTPUT / f"{task}_{kind}_metrics.json"

    joblib.dump(model, model_path)

    with metrics_path.open("w") as file:
        json.dump(metrics, file, indent=2)

    print(json.dumps(metrics, indent=2), flush=True)
    print(f"Saved: {model_path}", flush=True)
    print(f"Saved: {metrics_path}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--task",
        choices=["delay", "cancellation"],
        required=True,
    )
    parser.add_argument(
        "--model",
        choices=["logistic", "gradient_boosting"],
        required=True,
    )

    args = parser.parse_args()
    run(args.task, args.model)
