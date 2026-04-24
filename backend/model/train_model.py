from pathlib import Path

import joblib
from imblearn.over_sampling import SMOTE
from sklearn.metrics import classification_report
from xgboost import XGBClassifier

from utils.preprocess import generate_synthetic_data, load_and_preprocess


MODEL_DIR = Path(__file__).resolve().parent
MODEL_FILE = MODEL_DIR / "triage_model.pkl"
SCALER_FILE = MODEL_DIR / "scaler.pkl"
FEATURE_FILE = MODEL_DIR / "feature_names.pkl"
TRAIN_DATA_FILE = MODEL_DIR / "train_data.pkl"


def train_and_save_model(sample_size=5000, verbose=True):
    if verbose:
        print(f"Generating synthetic triage dataset (n={sample_size})...")
    df = generate_synthetic_data(n=sample_size)

    if verbose:
        print(f"Shape: {df.shape}")
        print(f"Urgency distribution:\n{df['urgency_level'].value_counts().sort_index()}")

    X_train, X_test, y_train, y_test = load_and_preprocess(df, save_dir=str(MODEL_DIR))

    if verbose:
        print("\nApplying SMOTE...")
    smote = SMOTE(random_state=42)
    X_train_resampled, y_train_resampled = smote.fit_resample(X_train, y_train)

    if verbose:
        print(f"Resampled shape: {X_train_resampled.shape}")
        print("\nTraining XGBoost model...")

    model = XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        eval_metric="mlogloss",
    )
    model.fit(X_train_resampled, y_train_resampled, eval_set=[(X_test, y_test)], verbose=False)

    y_pred = model.predict(X_test)
    report = classification_report(
        y_test,
        y_pred,
        target_names=["Immediate", "Urgent", "Less Urgent", "Non-Urgent"],
    )

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_FILE)
    joblib.dump(df[list(df.columns)], TRAIN_DATA_FILE)

    if verbose:
        print("\n=== Classification Report ===")
        print(report)
        print(f"\nModel saved to {MODEL_FILE}")

    return {
        "model_path": str(MODEL_FILE),
        "scaler_path": str(SCALER_FILE),
        "feature_path": str(FEATURE_FILE),
        "report": report,
    }


def ensure_model_artifacts():
    missing = [path for path in (MODEL_FILE, SCALER_FILE, FEATURE_FILE) if not path.exists()]
    if missing:
        print("Model artifacts missing. Training bootstrap model...")
        train_and_save_model(verbose=True)

    return {
        "model_path": str(MODEL_FILE),
        "scaler_path": str(SCALER_FILE),
        "feature_path": str(FEATURE_FILE),
    }


if __name__ == "__main__":
    train_and_save_model()
