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
- Historical weather coverage limits the evaluated population to weather-matched flights and may introduce selection bias.
- Cancellation ROC-AUC decreases from 0.7672 on validation to 0.6177 on final testing.
- Cancellation final-test recall is 0.0887, meaning approximately 91.13% of cancellations are missed at the evaluated threshold.
- Cancellation precision varies considerably between November and December.
- The original model-training script remains unavailable; a reconstructed training procedure reproduces the saved models' validation predictions.
- The available experiments do not establish the cause of temporal performance changes.
- Weather ablation results are validation-only and do not establish final-test improvement.

## Reproducibility

### Available source scripts

- `prepare_data.py`: prepares monthly BTS flight records and chronological splits.
- `join_weather.py`: performs historical origin-airport weather matching.
- `train_reproducible.py`: reconstructs training for four saved model configurations.
- `evaluate_models.py`: reproduces the selected models' final-test metrics.

### Reconstructed training procedure

For each prediction task, the reconstructed training experiment:

1. Loads weather-matched training records from January through August 2025.
2. Selects 300,000 records without replacement using `random_state=42`.
3. Clones the corresponding saved scikit-learn pipeline configuration.
4. Fits the cloned pipeline on the selected training records.
5. Evaluates predicted probabilities on all weather-matched September–October validation records.
6. Saves the reconstructed model locally and writes its validation metrics to JSON.

The original training sample-selection procedure was not documented. The reconstructed procedure is therefore reported separately rather than presented as the recovered original script.

### Prediction-level verification

The reconstructed models were compared against the original saved models across their complete weather-matched validation datasets.

| Task | Model | Validation predictions compared | Maximum absolute difference |
|---|---|---:|---:|
| Delay | Logistic Regression | 689,823 | 0 |
| Delay | Histogram Gradient Boosting | 689,823 | 0 |
| Cancellation | Logistic Regression | 695,115 | 0 |
| Cancellation | Histogram Gradient Boosting | 695,115 | 0 |

All four comparisons passed, totaling 2,769,876 probability predictions.

These results establish prediction-level agreement on the evaluated validation datasets. They do not independently establish the original development history or guarantee reproducibility across different software environments.

### Final-test evaluation

`evaluate_models.py` reproduces the saved final-test metrics for the selected histogram gradient-boosting models on November–December 2025 weather-matched records.

### Constant-score reference baseline

The final-test comparison includes a constant-score reference whose ROC-AUC is 0.5 and whose PR-AUC equals the test-set positive prevalence.

| Task | Baseline PR-AUC | Selected model PR-AUC |
|---|---:|---:|
| Delay | 0.2467 | 0.3882 |
| Cancellation | 0.0205 | 0.0535 |

This reference uses test-set prevalence and is not a separately fitted training-data baseline.

### Research artifacts

- Original saved scikit-learn pipelines
- Four reconstructed training metrics JSON files
- Full-validation model comparison
- Final-test metrics and confusion matrices
- Controlled weather ablation reports
- Monthly cancellation diagnostics
- Constant-score baseline comparison

Reconstructed `.joblib` models are generated locally and excluded from Git tracking.
