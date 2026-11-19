from pathlib import Path
import zipfile
import pandas as pd

ROOT = Path("research_2025")
RAW = ROOT / "data/raw/bts"
OUT = ROOT / "data/processed"
OUT.mkdir(parents=True, exist_ok=True)

columns = [
    "FlightDate", "Reporting_Airline",
    "Origin", "Dest", "CRSDepTime",
    "CRSArrTime", "CRSElapsedTime",
    "Distance", "DepDel15",
    "Cancelled", "Diverted"
]

files = sorted(RAW.glob("BTS_2025_*.zip"))
assert len(files) == 12, "Expected 12 monthly BTS ZIP files"

print("Processing 2025 BTS flight records...", flush=True)

counts = {"train": 0, "validation": 0, "test": 0}

for path in files:
    month = int(path.stem.split("_")[-1])

    if month <= 8:
        split = "train"
    elif month <= 10:
        split = "validation"
    else:
        split = "test"

    with zipfile.ZipFile(path) as archive:
        csv_name = next(
            name for name in archive.namelist()
            if name.lower().endswith(".csv")
        )

        with archive.open(csv_name) as source:
            df = pd.read_csv(
                source,
                usecols=columns,
                low_memory=False
            )

    df["FlightDate"] = pd.to_datetime(
        df["FlightDate"], errors="coerce"
    )

    df = df.dropna(subset=[
        "FlightDate", "Origin", "Dest",
        "CRSDepTime", "Cancelled"
    ])

    df["Month"] = df["FlightDate"].dt.month
    df["DayOfWeek"] = df["FlightDate"].dt.day_of_week
    df["ScheduledHour"] = (
        pd.to_numeric(df["CRSDepTime"], errors="coerce") // 100
    )

    df = df[
        df["ScheduledHour"].between(0, 23)
    ].copy()

    # Preserve cancellation labels for separate modeling.
    df["Cancelled"] = df["Cancelled"].astype(int)

    # Delay target is defined only for non-cancelled,
    # non-diverted flights with a recorded delay label.
    delay_df = df[
        (df["Cancelled"] == 0)
        & (df["Diverted"] == 0)
        & df["DepDel15"].notna()
    ].copy()

    delay_df["Delay15"] = delay_df["DepDel15"].astype(int)

    # Only scheduled/pre-departure fields are retained
    # as candidate predictive inputs.
    features = [
        "FlightDate", "Reporting_Airline",
        "Origin", "Dest", "CRSDepTime",
        "CRSArrTime", "CRSElapsedTime",
        "Distance", "Month", "DayOfWeek",
        "ScheduledHour"
    ]

    delay_output = OUT / f"delay_{split}_{month:02d}.parquet"
    delay_df[features + ["Delay15"]].to_parquet(
        delay_output, index=False
    )

    cancel_output = OUT / f"cancellation_{split}_{month:02d}.parquet"
    df[features + ["Cancelled"]].to_parquet(
        cancel_output, index=False
    )

    counts[split] += len(delay_df)

    print(
        f"Month {month:02d}: "
        f"{len(df):,} scheduled records, "
        f"{len(delay_df):,} delay-model records",
        flush=True
    )

print("\nCHRONOLOGICAL SPLIT SUMMARY")
for split, count in counts.items():
    print(f"{split}: {count:,} delay-model records")

print("\nSaved processed datasets to:", OUT.resolve())
print("Preprocessing completed successfully!")
