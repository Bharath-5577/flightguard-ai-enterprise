# FlightGuard AI — 2025 Machine Learning Research

## Research Objectives

Evaluate machine learning methods for predicting:
1. Departure delays of at least 15 minutes.
2. Flight cancellations.

## Dataset

Source: U.S. Bureau of Transportation Statistics (BTS), 2025 scheduled flight records.

## Chronological Data Split

- Training: January–August 2025
- Validation: September–October 2025
- Final testing: November–December 2025

Delay classification excludes cancelled and diverted flights and requires an observed departure-delay label.

## Predictive Features

Flight features:
- Reporting airline
- Origin airport
- Destination airport
- Flight distance
- Scheduled elapsed time
- Scheduled departure hour
- Month
- Day of week

Historical weather features:
- Temperature (tmpf)
- Dew point (dwpf)
- Wind speed (sknt)
- Visibility (vsby)
- Mean sea-level pressure (mslp)
- One-hour precipitation (p01i)

Weather observations are matched at the origin airport using a cutoff two hours before scheduled departure, with a three-hour backward matching tolerance.

## Models Compared

### Baseline: SGD Logistic Regression
- Loss: log_loss
- Penalty: L2
- Alpha: 0.0001
- Class weight: balanced
- Maximum iterations: 1000
- Random state: 42

Categorical features use one-hot encoding. Numerical features use median imputation, missingness indicators, and standard scaling.

### Selected Model: Histogram Gradient Boosting
- Learning rate: 0.08
- Maximum iterations: 120
- Maximum leaf nodes: 31
- Minimum samples per leaf: 20
- L2 regularization: 1.0
- Random state: 42

Categorical features use most-frequent imputation and ordinal encoding. Numerical features use median imputation.

## Evaluation Metrics

- ROC-AUC
- Precision-recall AUC
- Precision
- Recall
- F1-score
- Balanced accuracy
- Confusion matrix

## Full Validation Results

| Task | Model | ROC-AUC | PR-AUC | F1 |
|---|---|---:|---:|---:|
| Delay | Logistic | 0.6634 | 0.3074 | 0.3905 |
| Delay | Gradient Boosting | 0.6865 | 0.3449 | 0.4039 |
| Cancellation | Logistic | 0.7233 | 0.0261 | 0.0742 |
| Cancellation | Gradient Boosting | 0.7672 | 0.0404 | 0.1115 |

## Final Test Results

| Task | Test Rows | ROC-AUC | PR-AUC | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
| Delay | 663993 | 0.6706 | 0.3882 | 0.3479 | 0.6372 | 0.4501 |
| Cancellation | 679523 | 0.6177 | 0.0535 | 0.1426 | 0.0887 | 0.1094 |

The final-test counts correspond to the evaluated subsets, not all scheduled flights in the test months.

## Weather Ablation

| Task | Feature Set | ROC-AUC | PR-AUC |
|---|---|---:|---:|
| Delay | Flight only | 0.6791 | 0.3286 |
| Delay | Flight + weather | 0.6861 | 0.3443 |
| Cancellation | Flight only | 0.6760 | 0.0112 |
| Cancellation | Flight + weather | 0.7637 | 0.0306 |

These are validation results, not final-test ablation results.

## Limitations

- Historical weather matching covers approximately 59% of processed flight records.
- Cancellation prediction exhibits low final-test recall.
- Cancellation precision varies considerably between November and December.
- Saved training pipelines and evaluation reports exist, but the original model-training and evaluation scripts have not been located.
- The current reports do not establish the cause of temporal performance changes.

## Reproducibility

Available source scripts:
- prepare_data.py
- join_weather.py

Available artifacts:
- Saved scikit-learn model pipelines
- Validation metrics
- Final-test metrics
- Weather ablation reports
- Monthly cancellation diagnostics

Full training and evaluation reproducibility requires restoring or reconstructing the missing experiment scripts.
