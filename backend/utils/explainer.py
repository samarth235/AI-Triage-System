from pathlib import Path

import joblib
import numpy as np
import shap


MODEL_DIR = Path(__file__).resolve().parent.parent / "model"

_model = None
_explainer = None
_feature_names = None

FEATURE_LABELS = {
    "age": "Age",
    "heart_rate": "Heart Rate",
    "systolic_bp": "Systolic BP",
    "diastolic_bp": "Diastolic BP",
    "temperature": "Temperature",
    "oxygen_saturation": "SpO2 (%)",
    "respiratory_rate": "Resp. Rate",
    "pain_score": "Pain Score",
    "conscious_level": "Conscious Level",
    "arrival_mode": "Arrival Mode",
    "chief_complaint": "Chief Complaint",
}


def _load():
    global _model, _explainer, _feature_names
    if _model is None:
        _model = joblib.load(MODEL_DIR / "triage_model.pkl")
        _feature_names = joblib.load(MODEL_DIR / "feature_names.pkl")
        _explainer = shap.TreeExplainer(_model)


def get_explanation(patient_array):
    _load()
    shap_values = _explainer.shap_values(patient_array)
    probabilities = _model.predict_proba(patient_array)[0]
    predicted_class = int(np.argmax(probabilities))

    class_shap = shap_values[predicted_class][0]
    factors = []
    for index, feature_name in enumerate(_feature_names):
        factors.append(
            {
                "feature": feature_name,
                "label": FEATURE_LABELS.get(feature_name, feature_name),
                "value": float(patient_array[0][index]),
                "shap_value": float(class_shap[index]),
                "direction": "increases" if class_shap[index] > 0 else "decreases",
            }
        )

    factors.sort(key=lambda factor: abs(factor["shap_value"]), reverse=True)

    confidence = float(probabilities[predicted_class] * 100)
    return {
        "top_factors": factors[:5],
        "all_factors": factors,
        "predicted_class": predicted_class,
        "confidence": round(confidence, 1),
        "uncertain": confidence < 70,
        "probabilities": {
            "Immediate": round(float(probabilities[0]) * 100, 1),
            "Urgent": round(float(probabilities[1]) * 100, 1),
            "Less Urgent": round(float(probabilities[2]) * 100, 1),
            "Non-Urgent": round(float(probabilities[3]) * 100, 1),
        },
    }
