"""Isolated historical JFK CatBoost inference worker.

Run using the Python 3.11 ML environment.
Accepts one JSON request on standard input.
Returns one JSON response on standard output.
No authentication or HTTP server is provided here.
"""

from __future__ import annotations

import json
import sys

from backend.ml_inference import predict_delay_risk


def main() -> int:
    try:
        request = json.load(sys.stdin)

        if not isinstance(request, dict):
            raise ValueError("Request must be a JSON object")

        if set(request) != {"features"}:
            raise ValueError(
                "Request must contain exactly the features field"
            )

        result = predict_delay_risk(request["features"])

        print(json.dumps({
            "status": "success",
            "result": result,
        }, allow_nan=False))

        return 0

    except (ValueError, TypeError) as exc:
        print(json.dumps({
            "status": "error",
            "error": str(exc),
        }, allow_nan=False))
        return 1

    except Exception:
        # Do not disclose internal paths or model details to callers.
        print(json.dumps({
            "status": "error",
            "error": "Historical inference unavailable.",
        }))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
