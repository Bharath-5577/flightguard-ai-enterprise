"""Historical cancellation prediction HTTP endpoint."""

import json
import os
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/predictions", tags=["Historical Predictions"])

ROOT = Path(__file__).resolve().parents[2]
PYTHON = ROOT / "FlightGuard_AI_Download_Kit/.venv-ml/bin/python"
WORKER = Path(__file__).with_name("cancellation_worker.py")


class CancellationRequest(BaseModel):
    features: dict = Field(...)


@router.post("/cancellation")
def predict_cancellation(request: CancellationRequest):
    if not PYTHON.is_file() or not WORKER.is_file():
        raise HTTPException(status_code=503, detail="Prediction service unavailable")

    try:
        completed = subprocess.run(
            [str(PYTHON), "-B", str(WORKER)],
            input=json.dumps({"features": request.features}),
            text=True,
            capture_output=True,
            timeout=15,
            cwd=str(ROOT / "flightguard-enterprise"),
            env={
                **os.environ,
                "PYTHONPATH": str(ROOT / "flightguard-enterprise"),
            },
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        raise HTTPException(status_code=503, detail="Prediction service unavailable")

    try:
        response = json.loads(completed.stdout)
    except (ValueError, TypeError):
        raise HTTPException(status_code=503, detail="Invalid prediction service response")

    if completed.returncode != 0 or response.get("status") != "success":
        if response.get("status") == "error" and response.get("kind") == "validation":
            raise HTTPException(status_code=422, detail=response.get("error"))
        raise HTTPException(status_code=503, detail="Prediction service unavailable")

    return response["result"]
