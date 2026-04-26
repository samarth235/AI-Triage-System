import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { TriangleAlert as AlertTriangle, TrendingUp, LogOut, CreditCard as Edit3, ShieldAlert, Info } from "lucide-react";

const URGENCY_LABELS = ["Immediate", "Urgent", "Less Urgent", "Non-Urgent"];

const isCritical = (key, val) => {
  if (key === "oxygen_saturation" && val < 92) return true;
  if (key === "heart_rate" && (val > 120 || val < 50)) return true;
  if (key === "systolic_bp" && val < 100) return true;
  if (key === "temperature" && (val > 39.5 || val < 35.5)) return true;
  if (key === "respiratory_rate" && (val > 25 || val < 10)) return true;
  return false;
};

const VITALS_CONFIG = [
  { key: "heart_rate",        label: "HR",   unit: "bpm" },
  { key: "oxygen_saturation", label: "SpO2", unit: "%" },
  { key: "systolic_bp",       label: "BP Sys",unit: "" },
  { key: "temperature",       label: "Temp", unit: "°C" },
  { key: "respiratory_rate",  label: "RR",   unit: "/min" },
  { key: "pain_score",        label: "Pain", unit: "/10" },
];

export default function DetailPanel({ patient: p, onDischarge, onOverride, onViewTrend, API }) {
  const [overrideLevel, setOverrideLevel] = useState(p.urgency_level);
  const [overrideReason, setOverrideReason] = useState("");
  const [showOverride, setShowOverride] = useState(false);

  const maxShap = p.explanation?.length ? Math.max(...p.explanation.map(e => Math.abs(e.shap_value || 0))) : 1;

  const submitOverride = async () => {
    if (!overrideReason.trim()) { toast.error("Please provide a reason for override"); return; }
    await onOverride(p.id, overrideLevel, overrideReason);
    setShowOverride(false);
    setOverrideReason("");
  };

  const updateVitals = async () => {
    const hr = prompt("New Heart Rate (bpm):", p.vitals.heart_rate);
    const spo2 = prompt("New SpO2 (%):", p.vitals.oxygen_saturation);
    if (!hr || !spo2) return;
    try {
      const r = await axios.post(`${API}/api/vitals/update`, {
        patient_id: p.id,
        vitals: { heart_rate: parseInt(hr), oxygen_saturation: parseInt(spo2) },
      });
      if (r.data.upgraded) toast.error("Patient urgency upgraded — deteriorating vitals!");
      else toast.success("Vitals updated");
    } catch { toast.error("Failed to update vitals"); }
  };

  return (
    <div className="glass-card flex flex-col" style={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}>
          Patient Detail
        </span>
        <span className="font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>#{p.id}</span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Alerts */}
        {p.sepsis_flag && (
          <div className="alert-sepsis sepsis-pulse">
            <ShieldAlert size={13} />
            <div><strong>SEPSIS ALERT</strong> — {p.sepsis?.message}</div>
          </div>
        )}
        {p.uncertain && (
          <div className="alert-uncertain">
            <Info size={13} />
            <span>Low confidence ({p.confidence}%) — Escalate to senior doctor</span>
          </div>
        )}
        {p.pain_check?.inconsistency && (
          <div className="alert-pain">
            <AlertTriangle size={13} />
            <span>{p.pain_check.message}</span>
          </div>
        )}

        {/* Name + urgency */}
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold text-[15px] mb-0.5" style={{ color: "#f1f5f9" }}>{p.name}</div>
            <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.38)" }}>
              Age {p.age} · {p.age_group} · {p.chief_complaint}
            </div>
          </div>
          <div className="text-right shrink-0 ml-3">
            <span className={`pill-${p.urgency_level}`}>{p.urgency_label}</span>
            <div className="font-mono text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{p.confidence}% conf.</div>
          </div>
        </div>

        <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.32)" }}>
          Arrived: {p.arrival_time} · Max wait: {p.max_wait}
          {p.overridden && <span className="ml-2" style={{ color: "#facc15" }}>Overridden: {p.override_reason}</span>}
        </div>

        {/* Vitals */}
        <div>
          <div className="section-label">Vitals</div>
          <div className="vitals-grid">
            {VITALS_CONFIG.map(v => (
              <div key={v.key} className="vital-box">
                <div className={`vital-val ${isCritical(v.key, p.vitals[v.key]) ? "critical" : ""}`}>
                  {p.vitals[v.key]}{v.unit}
                </div>
                <div className="vital-lbl">{v.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Resources */}
        <div>
          <div className="section-label">Resources Required</div>
          <div className="flex flex-wrap gap-1.5">
            {p.resources_needed?.map((r, i) => <span key={i} className="chip">{r}</span>)}
          </div>
        </div>

        {/* SHAP explanation */}
        {p.explanation?.length > 0 && (
          <div>
            <div className="section-label">Why this urgency? (SHAP)</div>
            {p.explanation.map((e, i) => (
              <div key={i} className="shap-row">
                <span className="shap-label">{e.label}</span>
                <div className="shap-track">
                  <div
                    className={e.shap_value > 0 ? "shap-fill-pos" : "shap-fill-neg"}
                    style={{ width: `${(Math.abs(e.shap_value) / maxShap) * 100}%` }}
                  />
                </div>
                <span className="shap-num">{e.shap_value > 0 ? "+" : ""}{e.shap_value.toFixed(3)}</span>
              </div>
            ))}
            <div className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
              Red = increases urgency · Green = decreases urgency
            </div>
          </div>
        )}

        {/* SIRS detail */}
        {p.sepsis?.sirs_count > 0 && (
          <div>
            <div className="section-label">SIRS Criteria ({p.sepsis.sirs_count}/4 met)</div>
            <div className="space-y-1.5">
              {p.sepsis.sirs_criteria_met.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#f87171" }} />
                  <span className="flex-1">{s.criterion}</span>
                  <span className="font-mono" style={{ color: "#f87171" }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button className="btn" onClick={updateVitals}><TrendingUp size={12} />Update Vitals</button>
          <button className="btn btn-primary" onClick={onViewTrend}><TrendingUp size={12} />View Trend</button>
          <button className="btn btn-warning" onClick={() => setShowOverride(!showOverride)}><Edit3 size={12} />Override</button>
          <button className="btn btn-success" onClick={() => onDischarge(p.id)}><LogOut size={12} />Discharge</button>
        </div>

        {/* Override panel */}
        <AnimatePresence>
          {showOverride && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 14, overflow: "hidden" }}
            >
              <div className="section-label mb-3">Clinical Override</div>
              <div className="mb-3">
                <label className="field-label">New Urgency Level</label>
                <select className="field" value={overrideLevel} onChange={e => setOverrideLevel(parseInt(e.target.value))}>
                  {URGENCY_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
                </select>
              </div>
              <div className="mb-3">
                <label className="field-label">Clinical Reason (required)</label>
                <input className="field" value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="e.g. Atypical MI presentation" />
              </div>
              <button className="btn btn-danger w-full" onClick={submitOverride}>Confirm Override</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
