from __future__ import annotations

import csv
import sqlite3
from pathlib import Path
from contextlib import contextmanager

PROJECT_ROOT = Path(__file__).resolve().parents[1]

CSV_FILE = (
    PROJECT_ROOT.parent
    / "FlightGuard_AI_Download_Kit"
    / "data"
    / "processed"
    / "operational_risk_flights_2015_full_year_weather_enriched.csv"
)

DB_FILE = PROJECT_ROOT / "data" / "flights.sqlite3"


@contextmanager
def get_connection():
    connection = sqlite3.connect(DB_FILE, timeout=60)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA busy_timeout=60000")
    try:
        yield connection
    finally:
        connection.close()


def create_database():
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(DB_FILE) as db:
        db.execute("PRAGMA journal_mode=WAL")

        db.execute("""
            CREATE TABLE IF NOT EXISTS flights (
                id INTEGER PRIMARY KEY,
                flight_date TEXT NOT NULL,
                airline TEXT NOT NULL,
                origin TEXT NOT NULL,
                destination TEXT NOT NULL,
                scheduled_departure TEXT,
                departure_delay_minutes TEXT,
                delayed_15_minutes INTEGER NOT NULL,
                cancelled INTEGER NOT NULL,
                diverted INTEGER NOT NULL
            )
        """)

        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_airline ON flights(airline)",
            "CREATE INDEX IF NOT EXISTS idx_origin ON flights(origin)",
            "CREATE INDEX IF NOT EXISTS idx_destination ON flights(destination)",
            "CREATE INDEX IF NOT EXISTS idx_date ON flights(flight_date)",
            "CREATE INDEX IF NOT EXISTS idx_delay ON flights(delayed_15_minutes)",
            "CREATE INDEX IF NOT EXISTS idx_route ON flights(origin, destination)",
        ]

        for statement in indexes:
            db.execute(statement)


def import_csv():
    if not CSV_FILE.is_file():
        raise FileNotFoundError(f"CSV not found: {CSV_FILE}")

    create_database()

    sql = """
        INSERT INTO flights (
            flight_date, airline, origin, destination,
            scheduled_departure, departure_delay_minutes,
            delayed_15_minutes, cancelled, diverted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    imported = 0
    batch = []

    with sqlite3.connect(DB_FILE, timeout=60) as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA synchronous=NORMAL")
        db.execute("BEGIN")

        # Replace old imported data rather than duplicating it.
        db.execute("DELETE FROM flights")

        with CSV_FILE.open(
            encoding="utf-8-sig", newline=""
        ) as source:

            reader = csv.DictReader(source)

            for row in reader:
                batch.append((
                    row["FlightDate"],
                    row["Reporting_Airline"].strip().upper(),
                    row["Origin"].strip().upper(),
                    row["Dest"].strip().upper(),
                    row["CRSDepTime"],
                    row["DepDelayMinutes"],
                    int(float(row["DepDel15"] or 0) == 1),
                    int(float(row["Cancelled"] or 0) == 1),
                    int(float(row["Diverted"] or 0) == 1),
                ))

                if len(batch) >= 10000:
                    db.executemany(sql, batch)
                    imported += len(batch)
                    batch.clear()
                    print(f"Imported {imported:,} records...", flush=True)

            if batch:
                db.executemany(sql, batch)
                imported += len(batch)

        db.commit()

    return imported


def get_summary():
    with get_connection() as db:
        row = db.execute("""
            SELECT COUNT(*) AS total,
                   SUM(delayed_15_minutes) AS delayed,
                   COUNT(DISTINCT origin) AS airports
            FROM flights
        """).fetchone()

    total = row["total"]
    delayed = row["delayed"] or 0

    return {
        "total_flights": total,
        "delayed_flights": delayed,
        "origin_airports": row["airports"],
        "delay_rate_percent": round(100 * delayed / total, 2) if total else 0
    }


def get_grouped_analytics(group):
    columns = {
        "airline": "airline",
        "airport": "origin",
        "route": "origin, destination",
        "daily": "flight_date",
    }

    if group not in columns:
        raise ValueError("Invalid analytics grouping")

    with get_connection() as db:
        rows = db.execute(f"""
            SELECT {columns[group]},
                   COUNT(*) AS total,
                   SUM(delayed_15_minutes) AS delayed
            FROM flights
            GROUP BY {columns[group]}
        """).fetchall()

    results = []

    for row in rows:
        total = row["total"]
        delayed = row["delayed"] or 0

        item = {
            "total_flights": total,
            "delayed_flights": delayed,
            "delay_rate_percent": round(100 * delayed / total, 2)
        }

        if group == "airline":
            item["airline"] = row["airline"]
        elif group == "airport":
            item["airport"] = row["origin"]
        elif group == "route":
            item["origin"] = row["origin"]
            item["destination"] = row["destination"]
        else:
            item["date"] = row["flight_date"]

        results.append(item)

    return results


def search_flights(
    page=1, page_size=20, airline="",
    origin="", destination="", delayed_only=False
):
    conditions = []
    params = []

    for column, value in [
        ("airline", airline),
        ("origin", origin),
        ("destination", destination)
    ]:
        if value:
            conditions.append(f"{column} = ?")
            params.append(value.strip().upper())

    if delayed_only:
        conditions.append("delayed_15_minutes = 1")

    where = " WHERE " + " AND ".join(conditions) if conditions else ""

    with get_connection() as db:
        total = db.execute(
            f"SELECT COUNT(*) FROM flights {where}", params
        ).fetchone()[0]

        rows = db.execute(f"""
            SELECT flight_date, airline, origin, destination,
                   scheduled_departure, departure_delay_minutes,
                   delayed_15_minutes, cancelled, diverted
            FROM flights
            {where}
            ORDER BY id
            LIMIT ? OFFSET ?
        """, params + [page_size, (page - 1) * page_size]).fetchall()

    flights = []

    for row in rows:
        flights.append({
            "date": row["flight_date"],
            "airline": row["airline"],
            "origin": row["origin"],
            "destination": row["destination"],
            "scheduled_departure": row["scheduled_departure"],
            "departure_delay_minutes": row["departure_delay_minutes"],
            "delayed_15_minutes": bool(row["delayed_15_minutes"]),
            "cancelled": bool(row["cancelled"]),
            "diverted": bool(row["diverted"]),
        })

    return {"total_records": total, "flights": flights}


def get_airport_airlines(code):
    with get_connection() as db:
        rows = db.execute("""
            SELECT airline, COUNT(*) AS total,
                   SUM(delayed_15_minutes) AS delayed
            FROM flights
            WHERE origin = ?
            GROUP BY airline
            ORDER BY total DESC
            LIMIT 12
        """, (code.upper(),)).fetchall()

    return {
        row["airline"]: [row["total"], row["delayed"] or 0]
        for row in rows
    }


def get_copilot_data():
    summary = get_summary()

    airlines = get_grouped_analytics("airline")
    airports = get_grouped_analytics("airport")
    routes = get_grouped_analytics("route")
    daily = get_grouped_analytics("daily")

    return {
        "total_flights": summary["total_flights"],
        "delayed_total": summary["delayed_flights"],
        "airlines": {
            r["airline"]: [r["total_flights"], r["delayed_flights"]]
            for r in airlines
        },
        "airports": {
            r["airport"]: [r["total_flights"], r["delayed_flights"]]
            for r in airports
        },
        "routes": {
            (r["origin"], r["destination"]):
            [r["total_flights"], r["delayed_flights"]]
            for r in routes
        },
        "daily": {
            r["date"]: [r["total_flights"], r["delayed_flights"]]
            for r in daily
        }
    }
