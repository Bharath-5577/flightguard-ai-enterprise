# FlightGuard AI Enterprise

**FlightGuard AI Enterprise** is a research-oriented aviation intelligence platform combining historical flight operations, weather-enriched machine learning, and a multi-tenant airline analytics application.

The project investigates flight delay and cancellation prediction using 2025 historical flight records and NOAA weather observations.

> **Research limitation:** Model scores are experimental and are not calibrated probabilities or validated live aviation forecasts.

## Features

- Airline-specific dashboards and flight analytics
- Administrative workflows and organization management
- Historical flight delay and cancellation research
- Weather-enriched machine learning inputs
- Flight monitoring and operational intelligence
- Scenario-based financial impact exploration
- Reporting and research evaluation

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS |
| Backend | Python, FastAPI |
| Machine Learning | scikit-learn, pandas, joblib |
| Visualization | MapLibre GL |
| Research Data | 2025 flight operations and NOAA weather |

## Research Methodology

The research investigates two binary classification tasks:

1. **Flight delay prediction**
2. **Flight cancellation prediction**

Historical flight schedule and operational features are combined with weather observations. Preprocessing includes handling missing values and encoding categorical features.

The experiments compare Logistic Regression against Histogram Gradient Boosting.

The saved evaluation results include validation and held-out test metrics. These should be interpreted separately.

### Held-Out Test Results

| Metric | Delay | Cancellation |
|---|---:|---:|
| Test rows | 663,993 | 679,523 |
| ROC-AUC | 0.6706 | 0.6177 |
| PR-AUC | 0.3882 | 0.0535 |
| Precision | 0.3479 | 0.1426 |
| Recall | 0.6372 | 0.0887 |
| F1 | 0.4501 | 0.1094 |

Both test results are from Histogram Gradient Boosting models.

The cancellation model has limited positive-class recall. Its output should not be interpreted as a dependable operational cancellation forecast.

## Project Structure

```text
flightguard-enterprise/
├── backend/                 # FastAPI routes and inference services
├── src/app/                 # Next.js application pages
├── public/                  # Frontend assets
├── research_2025/
│   ├── prepare_data.py      # Research data preparation
│   ├── join_weather.py      # Weather integration
│   ├── data/                # Local datasets (excluded from Git)
│   └── results/             # Evaluation tables and metrics
├── package.json
└── README.md
```

## Running the Frontend

Install Node.js and npm, then run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The frontend expects a separately running FastAPI backend for API-powered features. The backend's dependencies, local data, and model artifacts must be configured before full functionality is available.

## Research Artifacts

The `research_2025/results/` directory contains evaluation CSV and JSON files.

Large processed Parquet datasets and serialized joblib models are excluded from Git to avoid publishing large local artifacts.

A fresh clone therefore does not contain everything required to reproduce model inference. The research scripts, data access, preprocessing configuration, and model training environment must be set up separately.

## Evaluation and Limitations

- Research evaluation uses historical 2025 flight data.
- Weather observations are historical and may not represent weather information available before departure.
- Class imbalance makes PR-AUC, recall, and precision particularly important for cancellation prediction.
- Model scores are not calibrated probabilities.
- The platform is a research prototype, not an operational airline decision system.
- Some application features require local services and data not included in the public repository.

## Research Purpose

FlightGuard AI Enterprise demonstrates how machine learning experiments can be connected to a modern airline analytics platform while clearly distinguishing experimental model performance from production-ready forecasting.

## License

No open-source license has been specified. All rights remain reserved unless a license is added.
