from datetime import datetime

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func


db = SQLAlchemy()


class Patient(db.Model):
    __tablename__ = "patients"

    id = db.Column(db.String(8), primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    age = db.Column(db.Integer, nullable=False)
    age_group = db.Column(db.String(20), nullable=False)
    chief_complaint_id = db.Column(db.Integer, nullable=False)
    chief_complaint = db.Column(db.String(120), nullable=False)
    urgency_level = db.Column(db.Integer, nullable=False, index=True)
    confidence = db.Column(db.Float, nullable=False)
    uncertain = db.Column(db.Boolean, nullable=False, default=False)
    resources_needed = db.Column(db.JSON, nullable=False, default=list)
    explanation = db.Column(db.JSON, nullable=False, default=list)
    sepsis_flag = db.Column(db.Boolean, nullable=False, default=False, index=True)
    sepsis = db.Column(db.JSON, nullable=False, default=dict)
    pain_check = db.Column(db.JSON, nullable=False, default=dict)
    heart_rate = db.Column(db.Integer, nullable=False)
    systolic_bp = db.Column(db.Integer, nullable=False)
    diastolic_bp = db.Column(db.Integer, nullable=False)
    temperature = db.Column(db.Float, nullable=False)
    oxygen_saturation = db.Column(db.Integer, nullable=False)
    respiratory_rate = db.Column(db.Integer, nullable=False)
    pain_score = db.Column(db.Integer, nullable=False)
    conscious_level = db.Column(db.Integer, nullable=False)
    arrival_mode = db.Column(db.Integer, nullable=False)
    arrival_timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    status = db.Column(db.String(20), nullable=False, default="waiting", index=True)
    overridden = db.Column(db.Boolean, nullable=False, default=False)
    override_reason = db.Column(db.Text)
    source = db.Column(db.String(30), nullable=False, default="er")
    discharged_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    vitals_readings = db.relationship(
        "VitalsReading",
        backref="patient",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="VitalsReading.timestamp",
    )


class VitalsReading(db.Model):
    __tablename__ = "vitals_readings"

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.String(8), db.ForeignKey("patients.id"), nullable=False, index=True)
    heart_rate = db.Column(db.Integer)
    systolic_bp = db.Column(db.Integer)
    diastolic_bp = db.Column(db.Integer)
    temperature = db.Column(db.Float)
    oxygen_saturation = db.Column(db.Integer)
    respiratory_rate = db.Column(db.Integer)
    pain_score = db.Column(db.Integer)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)


class AuditEntry(db.Model):
    __tablename__ = "audit_entries"

    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    patient_id = db.Column(db.String(8), index=True)
    patient_name = db.Column(db.String(120))
    action = db.Column(db.String(40), nullable=False, index=True)
    urgency_level = db.Column(db.Integer)
    urgency_label = db.Column(db.String(30))
    confidence = db.Column(db.Float)
    overridden = db.Column(db.Boolean, nullable=False, default=False)
    sepsis_flag = db.Column(db.Boolean, nullable=False, default=False)
    note = db.Column(db.Text)
    details = db.Column(db.JSON, nullable=False, default=dict)


class BedState(db.Model):
    __tablename__ = "bed_states"

    type = db.Column(db.String(30), primary_key=True)
    total = db.Column(db.Integer, nullable=False)
    occupied = db.Column(db.Integer, nullable=False)


DEFAULT_BEDS = {
    "icu": {"total": 6, "occupied": 4},
    "emergency": {"total": 12, "occupied": 7},
    "general": {"total": 20, "occupied": 15},
    "observation": {"total": 8, "occupied": 3},
}


def initialize_database(app):
    db.init_app(app)
    with app.app_context():
        db.create_all()
        seed_beds()


def seed_beds():
    existing = {row.type for row in BedState.query.all()}
    if existing:
        return

    for bed_type, values in DEFAULT_BEDS.items():
        db.session.add(BedState(type=bed_type, total=values["total"], occupied=values["occupied"]))
    db.session.commit()


def get_bed_snapshot():
    rows = BedState.query.order_by(BedState.type.asc()).all()
    return {row.type: {"total": row.total, "occupied": row.occupied} for row in rows}


def get_queue_stats():
    queue = Patient.query.filter_by(status="waiting")
    beds = get_bed_snapshot()
    return {
        "total": queue.count(),
        "immediate": queue.filter_by(urgency_level=0).count(),
        "urgent": queue.filter_by(urgency_level=1).count(),
        "less_urgent": queue.filter_by(urgency_level=2).count(),
        "non_urgent": queue.filter_by(urgency_level=3).count(),
        **beds,
    }


def get_shift_stats():
    triage_query = AuditEntry.query.filter(AuditEntry.action == "triage")
    return {
        "total": triage_query.count(),
        "immediate": triage_query.filter(AuditEntry.urgency_level == 0).count(),
        "urgent": triage_query.filter(AuditEntry.urgency_level == 1).count(),
        "less_urgent": triage_query.filter(AuditEntry.urgency_level == 2).count(),
        "non_urgent": triage_query.filter(AuditEntry.urgency_level == 3).count(),
        "overrides": AuditEntry.query.filter(AuditEntry.action == "override").count(),
        "sepsis_flags": triage_query.filter(AuditEntry.sepsis_flag.is_(True)).count(),
        "mass_casualty": AuditEntry.query.filter(AuditEntry.action == "mass_casualty_batch").count(),
    }


def count_patients_by_status():
    return (
        db.session.query(Patient.status, func.count(Patient.id))
        .group_by(Patient.status)
        .all()
    )
