"""Isolated historical cancellation prediction worker."""

import json
import sys

from backend.cancellation_inference_2025 import predict_cancellation_risk_2025


def main():
    try:
        request = json.load(sys.stdin)

        if not isinstance(request, dict) or set(request) != {"features"}:
            raise ValueError("Request must contain exactly the features field")

        result = predict_cancellation_risk_2025(request["features"])

        print(json.dumps({
            "status": "success",
            "result": result,
        }, allow_nan=False))
        return 0

    except (ValueError, TypeError) as exc:
        print(json.dumps({
            "status": "error",
            "kind": "validation",
            "error": str(exc),
        }))
        return 1

    except Exception:
        print(json.dumps({
            "status": "error",
            "kind": "service",
            "error": "Historical cancellation inference unavailable.",
        }))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
