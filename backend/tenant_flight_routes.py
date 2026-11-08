"""Authenticated, organization-scoped operational flight APIs."""

from datetime import date
from fastapi import APIRouter, Cookie, HTTPException, Query
from pydantic import BaseModel, Field

from backend.airline_routes import require_airline_user
from backend.tenant_flight_store import (
    update_flight_status,
    create_flight,
    list_flights,
    get_flight,
    flight_summary,
)

router = APIRouter(
    prefix="/api/airline/operations",
    tags=["Airline Operations"],
)


class FlightCreate(BaseModel):
    flight_number: str = Field(min_length=2, max_length=12)
    flight_date: date
    origin: str = Field(min_length=3, max_length=3, pattern=r"^[A-Za-z]{3}$")
    destination: str = Field(min_length=3, max_length=3, pattern=r"^[A-Za-z]{3}$")
    status: str = "scheduled"


def authenticated_organization(session_token):
    user = require_airline_user(session_token)

    organizations = user["organizations"]

    if len(organizations) != 1:
        raise HTTPException(
            status_code=403,
            detail="Exactly one active airline organization is required.",
        )

    return organizations[0]["organization_id"]


@router.get("/flights")
def airline_flights(
    limit: int = Query(default=100, ge=1, le=500),
    flightguard_session: str | None = Cookie(default=None),
):
    organization_id = authenticated_organization(flightguard_session)

    return {
        "data_scope": "organization_private",
        "flights": list_flights(organization_id, limit),
    }


@router.get("/summary")
def airline_operations_summary(
    flightguard_session: str | None = Cookie(default=None),
):
    organization_id = authenticated_organization(flightguard_session)

    return {
        "data_scope": "organization_private",
        "summary": flight_summary(organization_id),
    }


@router.get("/flights/{flight_id}")
def airline_flight_detail(
    flight_id: str,
    flightguard_session: str | None = Cookie(default=None),
):
    organization_id = authenticated_organization(flightguard_session)

    flight = get_flight(organization_id, flight_id)

    if flight is None:
        raise HTTPException(status_code=404, detail="Flight not found.")

    return flight


@router.post("/flights", status_code=201)
def airline_create_flight(
    payload: FlightCreate,
    flightguard_session: str | None = Cookie(default=None),
):
    organization_id = authenticated_organization(flightguard_session)

    try:
        flight_id = create_flight(
            organization_id=organization_id,
            flight_number=payload.flight_number.strip().upper(),
            flight_date=payload.flight_date.isoformat(),
            origin=payload.origin.upper(),
            destination=payload.destination.upper(),
            status=payload.status,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return {
        "id": flight_id,
        "status": "created",
    }


class FlightStatusUpdate(BaseModel):
    status: str = Field(min_length=1, max_length=20)


@router.patch("/flights/{flight_id}/status")
def airline_update_flight_status(
    flight_id: str,
    payload: FlightStatusUpdate,
    flightguard_session: str | None = Cookie(default=None),
):
    organization_id = authenticated_organization(flightguard_session)

    try:
        flight = update_flight_status(
            organization_id=organization_id,
            flight_id=flight_id,
            status=payload.status,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if flight is None:
        raise HTTPException(status_code=404, detail="Flight not found.")

    return {
        "data_scope": "organization_private",
        "flight": flight,
    }
