from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.flight_store import import_csv

if __name__ == "__main__":
    print("Starting FlightGuard SQLite migration...")

    total = import_csv()

    print("\n========== MIGRATION RESULT ==========")
    print(f"Imported records: {total:,}")
    print("Expected records: 2,654,399")

    if total != 2_654_399:
        raise SystemExit("Record count mismatch!")

    print("SQLite migration successful!")
