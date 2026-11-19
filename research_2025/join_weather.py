from pathlib import Path
import pandas as pd

BASE = Path("research_2025/data/processed")
OUT = BASE / "weather_enriched"
OUT.mkdir(parents=True, exist_ok=True)

zones = pd.read_csv(BASE / "airport_timezones_top25.csv")
zones = dict(zip(zones["Origin"], zones["timezone"]))

weather = pd.read_parquet(
    BASE / "weather_2025_top25.parquet"
)

weather["weather_time_utc"] = pd.to_datetime(
    weather["weather_time_utc"], utc=True
)

weather_by_airport = {
    airport: group.drop(columns=["Origin"]).sort_values(
        "weather_time_utc"
    )
    for airport, group in weather.groupby("Origin")
}

files = sorted(BASE.glob("cancellation_*.parquet"))
files += sorted(BASE.glob("delay_*.parquet"))

summary = []

for path in files:
    df = pd.read_parquet(path)
    df["_row_id"] = range(len(df))
    df["departure_utc"] = pd.NaT
    df["departure_utc"] = pd.to_datetime(
        df["departure_utc"], utc=True
    )

    valid_clock = pd.to_numeric(
        df["CRSDepTime"], errors="coerce"
    )
    hours = valid_clock // 100
    minutes = valid_clock % 100

    valid_clock = (
        valid_clock.notna()
        & hours.between(0, 24)
        & minutes.between(0, 59)
        & ((hours < 24) | (minutes == 0))
    )

    df["weather_time_utc"] = pd.NaT
    df["weather_time_utc"] = pd.to_datetime(
        df["weather_time_utc"], utc=True
    )

    weather_columns = [
        "tmpf", "dwpf", "sknt",
        "vsby", "mslp", "p01i"
    ]

    for col in weather_columns:
        df[col] = float("nan")

    df["weather_age_minutes"] = float("nan")

    for airport, timezone in zones.items():
        mask = (
            (df["Origin"] == airport)
            & valid_clock
        )

        if not mask.any():
            continue

        part = df.loc[mask].copy()

        local = (
            pd.to_datetime(part["FlightDate"]).dt.normalize()
            + pd.to_timedelta(hours.loc[mask], unit="h")
            + pd.to_timedelta(minutes.loc[mask], unit="m")
        )

        utc = (
            local.dt.tz_localize(
                timezone,
                ambiguous="NaT",
                nonexistent="NaT"
            )
            .dt.tz_convert("UTC")
        )

        part["departure_utc"] = utc
        part["prediction_cutoff_utc"] = (
            utc - pd.Timedelta(hours=2)
        )

        part = part.dropna(
            subset=["prediction_cutoff_utc"]
        ).sort_values("prediction_cutoff_utc")

        if part.empty:
            continue

        joined = pd.merge_asof(
            part,
            weather_by_airport[airport],
            left_on="prediction_cutoff_utc",
            right_on="weather_time_utc",
            direction="backward",
            tolerance=pd.Timedelta(hours=3),
            suffixes=("", "_matched")
        )

        matched = joined["weather_time_utc_matched"].notna()

        if matched.any():
            assert (
                joined.loc[matched, "weather_time_utc_matched"]
                <= joined.loc[matched, "prediction_cutoff_utc"]
            ).all(), "Future-weather leakage detected"

        ids = joined["_row_id"].to_numpy()

        df.loc[ids, "departure_utc"] = (
            joined["departure_utc"].array
        )
        df.loc[ids, "weather_time_utc"] = (
            joined["weather_time_utc_matched"].array
        )

        for col in weather_columns:
            df.loc[ids, col] = joined[
                f"{col}_matched"
            ].to_numpy()

        age = (
            joined["prediction_cutoff_utc"]
            - joined["weather_time_utc_matched"]
        ).dt.total_seconds() / 60

        df.loc[ids, "weather_age_minutes"] = age.to_numpy()

    df["weather_matched"] = (
        df["weather_time_utc"].notna()
    )

    matched_count = int(df["weather_matched"].sum())

    destination = OUT / path.name
    df.drop(columns=["_row_id"]).to_parquet(
        destination, index=False
    )

    summary.append({
        "file": path.name,
        "flights": len(df),
        "matched": matched_count,
        "match_rate_pct": round(
            100 * matched_count / len(df), 2
        )
    })

    print(
        f"{path.name}: "
        f"{matched_count:,}/{len(df):,} matched "
        f"({100 * matched_count / len(df):.2f}%)",
        flush=True
    )

report = pd.DataFrame(summary)
report.to_csv(
    Path("research_2025/results/weather_join_summary.csv"),
    index=False
)

print("\nOVERALL SUMMARY")
print(
    report.groupby(
        report["file"].str.split("_").str[0]
    )[["flights", "matched"]].sum().to_string()
)

print("\nSaved enriched datasets to:", OUT.resolve())
print("Saved summary to: research_2025/results/weather_join_summary.csv")
