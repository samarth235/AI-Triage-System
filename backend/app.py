import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from flask_socketio import SocketIO

sys.path.insert(0, os.path.dirname(__file__))

from database import (  # noqa: E402
    AuditEntry,
    BedState,
    Patient,
    VitalsReading,
    count_patients_by_status,
    db,
    get_bed_snapshot,
    get_queue_stats,
    get_shift_stats,
    initialize_database,
)
from utils.nlp_parser import parse_complaint  # noqa: E402
from utils.preprocess import CHIEF_COMPLAINTS  # noqa: E402
from utils.report_generator import generate_handover_report  # noqa: E402
from utils.sepsis import check_sepsis_risk  # noqa: E402


BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model"

load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "triage-secret-2024")
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL",
    "postgresql://triage:triage@localhost:5432/triage_db",
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Use NullPool for SQLite to avoid eventlet threading/lock conflicts
if app.config["SQLALCHEMY_DATABASE_URI"].startswith("sqlite"):
    from sqlalchemy.pool import NullPool
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"poolclass": NullPool}

cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",")]
CORS(app, resources={r"/*": {"origins": cors_origins}})
socketio = SocketIO(app, cors_allowed_origins=cors_origins, async_mode="threading")
initialize_database(app)

URGENCY_CONFIG = {
    0: {
        "label": "Immediate",
        "color": "red",
        "max_wait": "0 min",
        "description": "Life threatening",
    },
    1: {
        "label": "Urgent",
        "color": "orange",
        "max_wait": "10 min",
        "description": "May deteriorate",
    },
    2: {
        "label": "Less Urgent",
        "color": "yellow",
        "max_wait": "60 min",
        "description": "Stable",
    },
    3: {
        "label": "Non-Urgent",
        "color": "green",
        "max_wait": "120 min",
        "description": "Minor condition",
    },
}

RESOURCES = {
    0: ["ICU Bed", "Crash Cart", "Senior Doctor", "Nurse Immediate"],
    1: ["Monitoring Bed", "IV Access", "Doctor Within 10 min"],
    2: ["Standard Bed", "Nurse Assessment"],
    3: ["Waiting Area", "Junior Doctor"],
}

REQUIRED_TRIAGE_FIELDS = [
    "age",
    "heart_rate",
    "systolic_bp",
    "diastolic_bp",
    "temperature",
    "oxygen_saturation",
    "respiratory_rate",
    "pain_score",
    "conscious_level",
    "arrival_mode",
    "chief_complaint",
]

model = None
scaler = None


def load_model_artifacts():
    global model, scaler

    print("Loading triage model...")
    missing = [
        path
        for path in (MODEL_DIR / "triage_model.pkl", MODEL_DIR / "scaler.pkl", MODEL_DIR / "feature_names.pkl")
        if not path.exists()
    ]
    if missing:
        from model.train_model import ensure_model_artifacts

        ensure_model_artifacts()
    model = joblib.load(MODEL_DIR / "triage_model.pkl")
    scaler = joblib.load(MODEL_DIR / "scaler.pkl")
    print("Model loaded OK")


def _get_age_group(age):
    if age <= 1:
        return "infant"
    if age <= 12:
        return "child"
    if age >= 65:
        return "geriatric"
    return "adult"


def _pain_validator(pain_score, vitals):
    hr = vitals["heart_rate"]
    sbp = vitals["systolic_bp"]
    spo2 = vitals["oxygen_saturation"]
    physiological_severity = 0

    if hr > 120:
        physiological_severity += 2
    if sbp < 100:
        physiological_severity += 2
    if spo2 < 92:
        physiological_severity += 3
    if hr > 100:
        physiological_severity += 1

    inconsistency = False
    message = None

    if pain_score <= 3 and physiological_severity >= 4:
        inconsistency = True
        message = (
            f"Pain {pain_score}/10 appears UNDERREPORTED - vitals suggest severity "
            f"{min(10, physiological_severity * 1.5):.0f}/10. Patient may be in shock or minimizing symptoms."
        )
    elif pain_score >= 8 and physiological_severity == 0:
        message = f"Pain {pain_score}/10 reported but vitals are within normal range. Assess carefully."

    return {
        "inconsistency": inconsistency,
        "message": message,
        "physiological_score": physiological_severity,
    }


def _require_fields(data, fields):
    missing = [field for field in fields if field not in data or data[field] in (None, "")]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")


def _prediction_payload(data):
    if model is None or scaler is None:
        load_model_artifacts()

    _require_fields(data, REQUIRED_TRIAGE_FIELDS)
    features = np.array(
        [[
            int(data["age"]),
            int(data["heart_rate"]),
            int(data["systolic_bp"]),
            int(data["diastolic_bp"]),
            float(data["temperature"]),
            int(data["oxygen_saturation"]),
            int(data["respiratory_rate"]),
            int(data["pain_score"]),
            int(data["conscious_level"]),
            int(data["arrival_mode"]),
            int(data["chief_complaint"]),
        ]]
    )
    scaled = scaler.transform(features)
    urgency = int(model.predict(scaled)[0])
    probabilities = model.predict_proba(scaled)[0]
    confidence = round(float(probabilities[urgency] * 100), 1)

    try:
        from utils.explainer import get_explanation

        explanation = get_explanation(scaled)["top_factors"]
    except Exception:
        explanation = []

    return {
        "scaled": scaled,
        "urgency": urgency,
        "confidence": confidence,
        "explanation": explanation,
    }


def _create_patient_record(data, prediction, sepsis):
    patient_id = str(uuid.uuid4())[:8].upper()
    urgency_level = prediction["urgency"]
    urgency_config = URGENCY_CONFIG[urgency_level]
    age = int(data.get("age", 30))

    patient = Patient(
        id=patient_id,
        name=data.get("name", "Anonymous").strip() or "Anonymous",
        age=age,
        age_group=_get_age_group(age),
        chief_complaint_id=int(data.get("chief_complaint", 7)),
        chief_complaint=CHIEF_COMPLAINTS.get(int(data.get("chief_complaint", 7)), "Unknown"),
        urgency_level=urgency_level,
        confidence=prediction["confidence"],
        uncertain=prediction["confidence"] < 70,
        resources_needed=RESOURCES[urgency_level],
        explanation=prediction["explanation"],
        sepsis_flag=sepsis["flag"],
        sepsis=sepsis,
        pain_check=_pain_validator(int(data.get("pain_score", 0)), data),
        heart_rate=int(data.get("heart_rate")),
        systolic_bp=int(data.get("systolic_bp")),
        diastolic_bp=int(data.get("diastolic_bp")),
        temperature=float(data.get("temperature")),
        oxygen_saturation=int(data.get("oxygen_saturation")),
        respiratory_rate=int(data.get("respiratory_rate")),
        pain_score=int(data.get("pain_score")),
        conscious_level=int(data.get("conscious_level")),
        arrival_mode=int(data.get("arrival_mode", 0)),
        arrival_timestamp=datetime.utcnow(),
        status="waiting",
        overridden=False,
        override_reason=None,
        source=data.get("source", "er"),
    )
    patient._urgency_config = urgency_config
    return patient


def _create_vitals_reading(patient, vitals):
    return VitalsReading(
        patient_id=patient.id,
        heart_rate=int(vitals.get("heart_rate")),
        systolic_bp=int(vitals.get("systolic_bp")),
        diastolic_bp=int(vitals.get("diastolic_bp")),
        temperature=float(vitals.get("temperature")),
        oxygen_saturation=int(vitals.get("oxygen_saturation")),
        respiratory_rate=int(vitals.get("respiratory_rate")),
        pain_score=int(vitals.get("pain_score")),
    )


def _serialize_patient(patient):
    urgency_config = URGENCY_CONFIG[patient.urgency_level]
    return {
        "id": patient.id,
        "name": patient.name,
        "age": patient.age,
        "age_group": patient.age_group,
        "chief_complaint": patient.chief_complaint,
        "chief_complaint_id": patient.chief_complaint_id,
        "urgency_level": patient.urgency_level,
        "urgency_label": urgency_config["label"],
        "urgency_color": urgency_config["color"],
        "urgency_description": urgency_config["description"],
        "max_wait": urgency_config["max_wait"],
        "confidence": patient.confidence,
        "uncertain": patient.uncertain,
        "resources_needed": patient.resources_needed or [],
        "explanation": patient.explanation or [],
        "sepsis_flag": patient.sepsis_flag,
        "sepsis": patient.sepsis or {},
        "pain_check": patient.pain_check or {},
        "vitals": {
            "heart_rate": patient.heart_rate,
            "systolic_bp": patient.systolic_bp,
            "diastolic_bp": patient.diastolic_bp,
            "temperature": patient.temperature,
            "oxygen_saturation": patient.oxygen_saturation,
            "respiratory_rate": patient.respiratory_rate,
            "pain_score": patient.pain_score,
        },
        "arrival_time": patient.arrival_timestamp.strftime("%H:%M:%S"),
        "arrival_timestamp": patient.arrival_timestamp.isoformat(),
        "status": patient.status,
        "overridden": patient.overridden,
        "override_reason": patient.override_reason,
        "source": patient.source,
    }


def _serialize_audit_entry(entry):
    return {
        "timestamp": entry.timestamp.isoformat() if entry.timestamp else None,
        "patient_id": entry.patient_id,
        "patient_name": entry.patient_name,
        "action": entry.action,
        "urgency_level": entry.urgency_level,
        "urgency_label": entry.urgency_label,
        "confidence": entry.confidence,
        "overridden": entry.overridden,
        "sepsis_flag": entry.sepsis_flag,
        "note": entry.note,
        "details": entry.details or {},
    }


def _log_audit(patient, action, note=None, confidence=None, urgency_level=None, details=None):
    level = patient.urgency_level if urgency_level is None else urgency_level
    entry = AuditEntry(
        patient_id=patient.id,
        patient_name=patient.name,
        action=action,
        urgency_level=level,
        urgency_label=URGENCY_CONFIG[level]["label"] if level is not None else None,
        confidence=confidence,
        overridden=patient.overridden,
        sepsis_flag=patient.sepsis_flag,
        note=note,
        details=details or {},
    )
    db.session.add(entry)
    return entry


def _active_patients():
    return (
        Patient.query.filter_by(status="waiting")
        .order_by(Patient.urgency_level.asc(), Patient.arrival_timestamp.asc())
        .all()
    )


def _broadcast_queue_update():
    queue = [_serialize_patient(patient) for patient in _active_patients()]
    socketio.emit("queue_update", {"queue": queue, "stats": get_queue_stats()})


def _broadcast_beds():
    socketio.emit("bed_update", get_bed_snapshot())


def _analyze_trend(patient_id):
    history = (
        VitalsReading.query.filter_by(patient_id=patient_id)
        .order_by(VitalsReading.timestamp.asc())
        .all()
    )
    if len(history) < 2:
        return {"deteriorating": False, "signals": []}

    first = history[0]
    latest = history[-1]
    signals = []

    if (latest.oxygen_saturation or 100) < (first.oxygen_saturation or 100) - 3:
        signals.append("SpO2 dropping")
    if (latest.heart_rate or 80) > (first.heart_rate or 80) + 15:
        signals.append("Heart rate rising")
    if (latest.systolic_bp or 120) < (first.systolic_bp or 120) - 15:
        signals.append("BP dropping")
    if (latest.respiratory_rate or 16) > (first.respiratory_rate or 16) + 5:
        signals.append("Respiratory rate rising")

    return {"deteriorating": len(signals) >= 2, "signals": signals}


def _check_retriage_needed():
    now = datetime.utcnow()
    alerts = []
    wait_limits = {0: 0, 1: 10, 2: 60, 3: 120}

    for patient in _active_patients():
        waited_minutes = (now - patient.arrival_timestamp).total_seconds() / 60
        limit = wait_limits.get(patient.urgency_level, 120)
        if waited_minutes > limit:
            alerts.append(
                {
                    "patient_id": patient.id,
                    "name": patient.name,
                    "waited_minutes": round(waited_minutes, 1),
                    "limit": limit,
                }
            )

    if alerts:
        socketio.emit("retriage_alerts", alerts)
    return alerts


@app.route("/")
def index():
    return jsonify({
        "status": "online",
        "service": "AI Triage System API",
        "endpoints": {
            "health": "/api/health",
            "triage": "/api/triage",
            "queue": "/api/queue"
        }
    })


@app.route("/api/triage", methods=["POST"])
def triage_patient():
    try:
        data = request.get_json(silent=True) or {}
        prediction = _prediction_payload(data)
        sepsis = check_sepsis_risk(data)

        patient = _create_patient_record(data, prediction, sepsis)
        db.session.add(patient)
        db.session.flush()
        db.session.add(_create_vitals_reading(patient, data))
        _log_audit(
            patient,
            action="triage",
            confidence=prediction["confidence"],
            details={"source": patient.source},
        )
        db.session.commit()

        payload = _serialize_patient(patient)
        _broadcast_queue_update()
        _check_retriage_needed()

        return jsonify({"success": True, "patient": payload})
    except ValueError as error:
        db.session.rollback()
        return jsonify({"success": False, "error": str(error)}), 400
    except Exception as error:
        db.session.rollback()
        return jsonify({"success": False, "error": str(error)}), 500


@app.route("/api/ambulance/pretriage", methods=["POST"])
def ambulance_pretriage():
    try:
        data = request.get_json(silent=True) or {}
        data["source"] = "ambulance"
        data["arrival_mode"] = 1
        prediction = _prediction_payload(data)
        sepsis = check_sepsis_risk(data)

        pre_alert = {
            "id": "AMB-" + str(uuid.uuid4())[:6].upper(),
            "patient_name": data.get("name", "Incoming Patient"),
            "age": int(data.get("age", 0)),
            "eta_minutes": int(data.get("eta_minutes", 5)),
            "urgency_level": prediction["urgency"],
            "urgency_label": URGENCY_CONFIG[prediction["urgency"]]["label"],
            "urgency_color": URGENCY_CONFIG[prediction["urgency"]]["color"],
            "resources_needed": RESOURCES[prediction["urgency"]],
            "sepsis_flag": sepsis["flag"],
            "confidence": prediction["confidence"],
            "vitals": data,
            "timestamp": datetime.utcnow().isoformat(),
        }

        socketio.emit("ambulance_incoming", pre_alert)
        return jsonify({"success": True, "pre_alert": pre_alert})
    except ValueError as error:
        return jsonify({"success": False, "error": str(error)}), 400
    except Exception as error:
        return jsonify({"success": False, "error": str(error)}), 500


@app.route("/api/vitals/update", methods=["POST"])
def update_vitals():
    try:
        data = request.get_json(silent=True) or {}
        patient_id = data.get("patient_id")
        new_vitals = data.get("vitals", {})

        patient = db.session.get(Patient, patient_id)
        if not patient or patient.status != "waiting":
            return jsonify({"success": False, "error": "Patient not found"}), 404

        reading = VitalsReading(
            patient_id=patient.id,
            heart_rate=int(new_vitals.get("heart_rate", patient.heart_rate)),
            systolic_bp=int(new_vitals.get("systolic_bp", patient.systolic_bp)),
            diastolic_bp=int(new_vitals.get("diastolic_bp", patient.diastolic_bp)),
            temperature=float(new_vitals.get("temperature", patient.temperature)),
            oxygen_saturation=int(new_vitals.get("oxygen_saturation", patient.oxygen_saturation)),
            respiratory_rate=int(new_vitals.get("respiratory_rate", patient.respiratory_rate)),
            pain_score=int(new_vitals.get("pain_score", patient.pain_score)),
        )
        db.session.add(reading)

        patient.heart_rate = reading.heart_rate
        patient.systolic_bp = reading.systolic_bp
        patient.diastolic_bp = reading.diastolic_bp
        patient.temperature = reading.temperature
        patient.oxygen_saturation = reading.oxygen_saturation
        patient.respiratory_rate = reading.respiratory_rate
        patient.pain_score = reading.pain_score
        patient.pain_check = _pain_validator(patient.pain_score, new_vitals | {
            "heart_rate": patient.heart_rate,
            "systolic_bp": patient.systolic_bp,
            "oxygen_saturation": patient.oxygen_saturation,
        })

        trend = _analyze_trend(patient.id)
        upgraded = False

        if trend["deteriorating"] and patient.urgency_level > 0:
            old_level = patient.urgency_level
            patient.urgency_level = max(0, patient.urgency_level - 1)
            upgraded = True
            _log_audit(
                patient,
                action="auto_upgrade",
                note=(
                    f"Auto-upgraded from {URGENCY_CONFIG[old_level]['label']} due to "
                    f"{', '.join(trend['signals'])}"
                ),
            )
            socketio.emit("patient_upgraded", {"patient_id": patient.id, "new_urgency": patient.urgency_level})

        db.session.commit()
        _broadcast_queue_update()

        return jsonify({"success": True, "trend": trend, "upgraded": upgraded})
    except Exception as error:
        db.session.rollback()
        return jsonify({"success": False, "error": str(error)}), 500


@app.route("/api/vitals/history/<patient_id>", methods=["GET"])
def get_vitals_history(patient_id):
    patient = db.session.get(Patient, patient_id)
    if not patient:
        return jsonify({"success": False, "error": "Patient not found"}), 404

    history = (
        VitalsReading.query.filter_by(patient_id=patient_id)
        .order_by(VitalsReading.timestamp.asc())
        .all()
    )
    trend = _analyze_trend(patient_id) if len(history) >= 2 else {"deteriorating": False, "signals": []}
    return jsonify(
        {
            "success": True,
            "history": [
                {
                    "timestamp": row.timestamp.isoformat(),
                    "heart_rate": row.heart_rate,
                    "systolic_bp": row.systolic_bp,
                    "diastolic_bp": row.diastolic_bp,
                    "temperature": row.temperature,
                    "oxygen_saturation": row.oxygen_saturation,
                    "respiratory_rate": row.respiratory_rate,
                    "pain_score": row.pain_score,
                }
                for row in history
            ],
            "trend": trend,
        }
    )


@app.route("/api/retriage/check", methods=["GET"])
def check_retriage():
    alerts = _check_retriage_needed()
    return jsonify({"success": True, "alerts": alerts})


@app.route("/api/mass-casualty", methods=["POST"])
def mass_casualty():
    try:
        patients_data = (request.get_json(silent=True) or {}).get("patients", [])
        results = []

        for data in patients_data:
            prediction = _prediction_payload(data)
            sepsis = check_sepsis_risk(data)
            patient = _create_patient_record(data | {"source": "mass_casualty"}, prediction, sepsis)
            db.session.add(patient)
            db.session.flush()
            db.session.add(_create_vitals_reading(patient, data))
            _log_audit(
                patient,
                action="triage",
                confidence=prediction["confidence"],
                details={"source": "mass_casualty"},
            )
            results.append(patient)

        if patients_data:
            db.session.add(
                AuditEntry(
                    action="mass_casualty_batch",
                    note=f"Processed {len(patients_data)} patients during MCI mode",
                )
            )

        db.session.commit()
        _broadcast_queue_update()

        serialized = [_serialize_patient(patient) for patient in sorted(results, key=lambda item: item.urgency_level)]
        return jsonify(
            {
                "success": True,
                "processed": len(serialized),
                "results": serialized,
                "summary": {
                    "immediate": sum(1 for patient in serialized if patient["urgency_level"] == 0),
                    "urgent": sum(1 for patient in serialized if patient["urgency_level"] == 1),
                    "less_urgent": sum(1 for patient in serialized if patient["urgency_level"] == 2),
                    "non_urgent": sum(1 for patient in serialized if patient["urgency_level"] == 3),
                },
            }
        )
    except ValueError as error:
        db.session.rollback()
        return jsonify({"success": False, "error": str(error)}), 400
    except Exception as error:
        db.session.rollback()
        return jsonify({"success": False, "error": str(error)}), 500


@app.route("/api/queue", methods=["GET"])
def get_queue():
    return jsonify(
        {
            "success": True,
            "queue": [_serialize_patient(patient) for patient in _active_patients()],
            "stats": get_queue_stats(),
        }
    )


@app.route("/api/override", methods=["POST"])
def override_triage():
    try:
        data = request.get_json(silent=True) or {}
        patient = db.session.get(Patient, data.get("patient_id"))
        if not patient or patient.status != "waiting":
            return jsonify({"success": False, "error": "Patient not found"}), 404

        new_level = int(data["new_urgency_level"])
        patient.urgency_level = new_level
        patient.overridden = True
        patient.override_reason = data.get("reason", "Clinical judgment")
        _log_audit(patient, action="override", note=patient.override_reason)
        db.session.commit()

        _broadcast_queue_update()
        return jsonify({"success": True, "patient": _serialize_patient(patient)})
    except Exception as error:
        db.session.rollback()
        return jsonify({"success": False, "error": str(error)}), 500


@app.route("/api/discharge", methods=["POST"])
def discharge_patient():
    try:
        data = request.get_json(silent=True) or {}
        patient = db.session.get(Patient, data.get("patient_id"))
        if not patient or patient.status != "waiting":
            return jsonify({"success": False, "error": "Patient not found"}), 404

        patient.status = "discharged"
        patient.discharged_at = datetime.utcnow()
        db.session.commit()
        _broadcast_queue_update()
        return jsonify({"success": True})
    except Exception as error:
        db.session.rollback()
        return jsonify({"success": False, "error": str(error)}), 500


@app.route("/api/parse-complaint", methods=["POST"])
def parse_complaint_endpoint():
    text = (request.get_json(silent=True) or {}).get("text", "")
    return jsonify({"success": True, "result": parse_complaint(text)})


@app.route("/api/beds", methods=["GET"])
def get_beds():
    return jsonify({"success": True, "beds": get_bed_snapshot()})


@app.route("/api/beds/update", methods=["POST"])
def update_beds():
    try:
        data = request.get_json(silent=True) or {}
        bed_type = data.get("type")
        action = data.get("action")

        bed = db.session.get(BedState, bed_type)
        if not bed:
            return jsonify({"success": False, "error": "Bed type not found"}), 404

        if action == "occupy" and bed.occupied < bed.total:
            bed.occupied += 1
        elif action == "free" and bed.occupied > 0:
            bed.occupied -= 1

        db.session.commit()
        snapshot = get_bed_snapshot()
        _broadcast_beds()
        return jsonify({"success": True, "beds": snapshot})
    except Exception as error:
        db.session.rollback()
        return jsonify({"success": False, "error": str(error)}), 500


@app.route("/api/audit", methods=["GET"])
def get_audit_log():
    entries = AuditEntry.query.order_by(AuditEntry.timestamp.desc()).limit(500).all()
    return jsonify({"success": True, "log": [_serialize_audit_entry(entry) for entry in entries]})


@app.route("/api/handover", methods=["POST"])
def generate_handover():
    shift_info = request.get_json(silent=True) or {}
    queue = [_serialize_patient(patient) for patient in _active_patients()]
    filename = generate_handover_report(queue, get_shift_stats(), shift_info)
    return send_file(
        filename,
        as_attachment=True,
        download_name="shift_handover.pdf",
        mimetype="application/pdf",
    )


@app.route("/api/health", methods=["GET"])
def health():
    db_ok = True
    try:
        count_patients_by_status()
    except Exception:
        db_ok = False

    return jsonify(
        {
            "status": "ok" if db_ok and model and scaler else "degraded",
            "model": "loaded" if model and scaler else "not_loaded",
            "database": "connected" if db_ok else "unreachable",
        }
    )



# Initialize model on startup
load_model_artifacts()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    socketio.run(app, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true", host="0.0.0.0", port=port)
