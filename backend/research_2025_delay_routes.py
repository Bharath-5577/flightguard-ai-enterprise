"""Isolated API for 2025 historical delay research."""
from fastapi import APIRouter, HTTPException, Cookie, Request
from pydantic import BaseModel, Field

from backend.research_2025_delay import predict
from backend.airline_routes import require_airline_user
from backend.auth_routes import require_same_origin

router = APIRouter(
    prefix="/api/predictions",
    tags=["2025 Historical Research"],
)

class ResearchDelayRequest(BaseModel):
    features: dict = Field(...)

@router.post("/delay-2025-research")
def predict_research_delay(
    request: ResearchDelayRequest,
    http_request: Request,
    flightguard_session: str | None = Cookie(default=None),
):
    require_same_origin(http_request)
    require_airline_user(flightguard_session)
    try:
        return predict(request.features)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="2025 research prediction unavailable.",
        ) from exc
