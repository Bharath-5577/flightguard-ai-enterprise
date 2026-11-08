"""Authenticated airline customer endpoints."""

from fastapi import APIRouter, Cookie, HTTPException, Query

from backend.auth_routes import get_session_user

router = APIRouter(
    prefix="/api/airline",
    tags=["Airline Customer Workspace"],
)


def require_airline_user(session_token: str | None):
    """Validate a customer session and active organization membership."""
    user = get_session_user(session_token)

    if user["is_platform_admin"]:
        raise HTTPException(
            status_code=403,
            detail="Administrator accounts cannot use the airline portal.",
        )

    if not user["organizations"]:
        raise HTTPException(
            status_code=403,
            detail="No active organization membership.",
        )

    return user


@router.get("/workspace")
def airline_workspace(
    flightguard_session: str | None = Cookie(default=None),
):
    """Return only the authenticated user's organization information."""
    user = require_airline_user(flightguard_session)

    return {
        "email": user["email"],
        "organizations": user["organizations"],
        "workspace_status": "active",
    }


@router.get("/historical-analytics")
def historical_analytics(
    flightguard_session: str | None = Cookie(default=None),
):
    """Shared historical aviation data for authenticated airline customers."""
    require_airline_user(flightguard_session)

    from backend.main import (
        flights_summary,
        airline_analytics,
        airport_analytics,
        route_analytics,
        daily_analytics,
    )

    return {
        "status": "success",
        "data_scope": "shared_historical",
        "source": "Historical BTS network dataset",
        "organization_specific": False,
        "summary": flights_summary(),
        "airlines": airline_analytics()["airlines"],
        "airports": airport_analytics()["airports"],
        "routes": route_analytics(limit=10, min_flights=100)["routes"],
        "daily": daily_analytics()["daily"],
    }


@router.get("/filtered-performance")
@router.get("/filtered-performance")
def filtered_performance(
    airline: str = Query("", max_length=3, pattern=r"^[A-Za-z0-9]*$"),
    origin: str = Query("", max_length=3, pattern=r"^[A-Za-z]*$"),
    destination: str = Query("", max_length=3, pattern=r"^[A-Za-z]*$"),
    flightguard_session: str | None = Cookie(default=None),
):
    """Authenticated shared-historical statistics using SQLite aggregation."""
    require_airline_user(flightguard_session)

    from backend.flight_store import get_connection

    carrier = airline.strip().upper()
    airport = origin.strip().upper()
    destination_airport = destination.strip().upper()

    conditions = []
    parameters = []

    if carrier:
        conditions.append("airline = ?")
        parameters.append(carrier)

    if airport:
        conditions.append("origin = ?")
        parameters.append(airport)

    base_where = (
        " WHERE " + " AND ".join(conditions)
        if conditions else ""
    )

    metric_conditions = list(conditions)
    metric_parameters = list(parameters)

    if destination_airport:
        metric_conditions.append("destination = ?")
        metric_parameters.append(destination_airport)

    metric_where = (
        " WHERE " + " AND ".join(metric_conditions)
        if metric_conditions else ""
    )

    with get_connection() as db:
        destinations = db.execute(
            "SELECT DISTINCT destination FROM flights"
            + base_where
            + " AND destination IS NOT NULL"
            if base_where else
            "SELECT DISTINCT destination FROM flights "
            "WHERE destination IS NOT NULL",
            parameters,
        ).fetchall()

        result = db.execute(
            "SELECT COUNT(*) AS total, "
            "COALESCE(SUM(delayed_15_minutes), 0) AS delayed "
            "FROM flights" + metric_where,
            metric_parameters,
        ).fetchone()

    total = result["total"]
    delayed = result["delayed"]

    return {
        "status": "success",
        "data_scope": "shared_historical",
        "organization_specific": False,
        "source": "Historical BTS network dataset",
        "filters": {
            "airline": carrier or None,
            "origin": airport or None,
            "destination": destination_airport or None,
        },
        "available_destinations": sorted(
            row["destination"]
            for row in destinations
            if row["destination"]
        ),
        "total_flights": total,
        "delayed_flights": delayed,
        "delay_rate_percent": (
            round(100 * delayed / total, 2)
            if total else 0.0
        ),
    }
