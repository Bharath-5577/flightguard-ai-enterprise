"""Organization-scoped operational flight storage."""

import sqlite3
import uuid
from pathlib import Path

DB_FILE = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "airline_operations.sqlite3"
)

VALID_STATUSES = {
    "scheduled",
    "departed",
    "arrived",
    "delayed",
    "cancelled",
    "diverted",
}


def connect_operations():
    connection = sqlite3.connect(
        DB_FILE,
        timeout=30,
    )
    connection.row_factory = sqlite3.Row
    return connection


def create_flight(
    organization_id,
    flight_number,
    flight_date,
    origin,
    destination,
    status="scheduled",
):
    if not organization_id:
        raise ValueError("Organization ID is required.")

    if status not in VALID_STATUSES:
        raise ValueError("Invalid flight status.")

    flight_id = str(uuid.uuid4())

    with connect_operations() as db:
        db.execute(
            """
            INSERT INTO operational_flights (
                id,
                organization_id,
                flight_number,
                flight_date,
                origin,
                destination,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                flight_id,
                organization_id,
                flight_number,
                flight_date,
                origin,
                destination,
                status,
            ),
        )

    return flight_id


def list_flights(organization_id, limit=100):
    if not organization_id:
        raise ValueError("Organization ID is required.")

    limit = max(1, min(int(limit), 500))

    with connect_operations() as db:
        rows = db.execute(
            """
            SELECT
                id,
                flight_number,
                flight_date,
                origin,
                destination,
                scheduled_departure,
                actual_departure,
                departure_delay_minutes,
                status,
                created_at
            FROM operational_flights
            WHERE organization_id = ?
            ORDER BY flight_date DESC, created_at DESC
            LIMIT ?
            """,
            (organization_id, limit),
        ).fetchall()

    return [dict(row) for row in rows]


def get_flight(organization_id, flight_id):
    if not organization_id:
        raise ValueError("Organization ID is required.")

    with connect_operations() as db:
        row = db.execute(
            """
            SELECT *
            FROM operational_flights
            WHERE organization_id = ?
              AND id = ?
            """,
            (organization_id, flight_id),
        ).fetchone()

    return dict(row) if row else None


def flight_summary(organization_id):
    if not organization_id:
        raise ValueError("Organization ID is required.")

    with connect_operations() as db:
        row = db.execute(
            """
            SELECT
                COUNT(*) AS total_flights,
                SUM(
                    CASE WHEN status = 'delayed'
                    THEN 1 ELSE 0 END
                ) AS delayed_flights,
                SUM(
                    CASE WHEN status = 'cancelled'
                    THEN 1 ELSE 0 END
                ) AS cancelled_flights
            FROM operational_flights
            WHERE organization_id = ?
            """,
            (organization_id,),
        ).fetchone()

    return {
        "total_flights": row["total_flights"],
        "delayed_flights": row["delayed_flights"],
        "cancelled_flights": row["cancelled_flights"],
    }


def update_flight_status(organization_id, flight_id, status):
    """Update a flight only when it belongs to the specified organization."""
    if not organization_id:
        raise ValueError("Organization ID is required.")

    if status not in VALID_STATUSES:
        raise ValueError("Invalid flight status.")

    with connect_operations() as db:
        cursor = db.execute(
            """
            UPDATE operational_flights
            SET status = ?
            WHERE id = ?
              AND organization_id = ?
            """,
            (status, flight_id, organization_id),
        )

        if cursor.rowcount != 1:
            return None

    return get_flight(organization_id, flight_id)
