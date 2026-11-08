"""Historical JFK departure-delay prediction API."""

import json
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

ROOT = Path(__file__).resolve().parents[2]
ML_PYTHON = ROOT / "FlightGuard_AI_Download_Kit" / ".venv-ml" / "bin" / "python"


class DelayRequest(BaseModel):
    features: dict


@router.post("/api/predictions/delay")
def predict_delay(request: DelayRequest):
    if not ML_PYTHON.is_file():
        raise HTTPException(
            status_code=503,
            detail="Historical delay inference environment unavailable."
        )

    try:
        process = subprocess.run(
            [str(ML_PYTHON), "-m", "backend.ml_worker"],
            input=json.dumps({"features": request.features}),
            text=True,
            capture_output=True,
            cwd=str(ROOT / "flightguard-enterprise"),
            timeout=60,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        raise HTTPException(
            status_code=503,
            detail="Historical delay inference unavailable."
        )

    try:
        output = json.loads(process.stdout)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=503,
            detail="Invalid historical inference response."
        )

    if process.returncode != 0 or output.get("status") != "success":
        if output.get("status") == "error" and output.get("error") != "Historical inference unavailable.":
            raise HTTPException(status_code=422, detail=output["error"])

        raise HTTPException(
            status_code=503,
            detail="Historical delay inference unavailable."
        )

    return output["result"]
