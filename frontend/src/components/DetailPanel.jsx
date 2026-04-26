import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Activity, AlertTriangle, BarChart3, HeartPulse, ShieldAlert } from "lucide-react";

const URGENCY_LABELS = ["Immediate", "Urgent", "Less Urgent", "Non-Urgent"];

export default function DetailPanel({ patient: p, onDischarge, onOverride, onViewTrend, API }) {
  const [overrideLevel, setOverrideLevel] = useState(p.urgency_level);
  const [overrideReason, setOverrideReason] = useState("");
  const [showOverride, setShowOverride] = useState(false);

  const maxShap = p.explanation?.length ? Math.max(...p.explanation.map((e) => Math.abs(e.shap_value || 0))) : 1;

  const isCriticalVital = (key, val) => {
    if (key === "oxygen_saturation" && val < 92) return true;
    if (key === "heart_rate" && (val > 120 || val < 50)) return true;
    if (key === "systolic_bp" && val < 100) return true;
    if (key === "temperature" && (val > 39.5 || val < 35.5)) return true;
    if (key === "respiratory_rate" && (val > 25 || val < 10)) return true;
    return false;
  };

  const submitOverride = async () => {
    if (!overrideReason.trim()) {
      toast.error("Please provide a reason for override");
      return;
    }
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
        vitals: { heart_rate: parseInt(hr, 10), oxygen_saturation: parseInt(spo2, 10) },
      });
      if (r.data.upgraded) toast.error("Patient urgency upgraded due to deteriorating vitals");
      else toast.success("Vitals updated");
    } catch {
      toast.error("Failed to update vitals");
    }
  };

  return (
    <div className="glass-card">
      <div className="glass-head">
        <span className="card-title">Patient Detail</span>
        <span className="card-badge">#{p.id}</span>
      </div>
      <div className="space-y-3 p-4">
        {p.sepsis_flag && (
          <div className="flex items-center gap-2 rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs text-red-200">
            <ShieldAlert size={18} strokeWidth={1.5} />
            <strong>SEPSIS ALERT</strong> - {p.sepsis?.message}
          </div>
        )}
        {p.uncertain && (
          <div className="flex items-center gap-2 rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-2 text-xs text-violet-200">
            <AlertTriangle size={18} strokeWidth={1.5} />
            Low confidence ({p.confidence}%) - escalate to senior doctor for review
          </div>
        )}

        <div className="flex items-start justify-between">
          <div>
            <div className="text-base font-semibold">{p.name}</div>
            <div className="text-xs text-slate-400">Age {p.age} - {p.age_group} - {p.chief_complaint}</div>
          </div>
          <div className="text-right">
            <span className="rounded-full border border-white/15 bg-slate-950/50 px-2 py-1 font-mono text-[10px] uppercase tracking-wide">{p.urgency_label}</span>
            <div className="mt-1 font-mono text-[11px] text-slate-400">{p.confidence}% confidence</div>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Arrived: {p.arrival_time} - Max wait: {p.max_wait}
          {p.overridden && <span className="ml-2 text-yellow-300">Overridden: {p.override_reason}</span>}
        </div>

        <div className="pt-1">
          <div className="mb-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500"><HeartPulse size={18} strokeWidth={1.5} />Vitals</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "heart_rate", label: "HR", unit: "bpm" },
              { key: "oxygen_saturation", label: "SpO2", unit: "%" },
              { key: "systolic_bp", label: "BP Sys", unit: "" },
              { key: "temperature", label: "Temp", unit: "C" },
              { key: "respiratory_rate", label: "RR", unit: "/min" },
              { key: "pain_score", label: "Pain", unit: "/10" },
            ].map((v) => (
              <div key={v.key} className="rounded-lg border border-white/10 bg-slate-950/50 p-2 text-center">
                <div className={`font-mono text-lg font-semibold ${isCriticalVital(v.key, p.vitals[v.key]) ? "text-red-300" : "text-slate-100"}`}>{p.vitals[v.key]}{v.unit}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{v.label}</div>
              </div>
            ))}
          </div>
        </div>

        {p.explanation?.length > 0 && (
          <div>
            <div className="mb-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500"><BarChart3 size={18} strokeWidth={1.5} />SHAP Drivers</div>
            {p.explanation.map((e, i) => (
              <div key={i} className="mb-2 flex items-center gap-2">
                <span className="w-24 truncate text-xs text-slate-400">{e.label}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-slate-950/70">
                  <div className={`h-full ${e.shap_value > 0 ? "bg-red-400/80" : "bg-emerald-400/80"}`} style={{ width: `${(Math.abs(e.shap_value) / maxShap) * 100}%` }} />
                </div>
                <span className="w-14 text-right font-mono text-[11px] text-slate-300">{e.shap_value > 0 ? "up" : "down"} {Math.abs(e.shap_value).toFixed(3)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button className="btn" onClick={updateVitals}><Activity size={18} strokeWidth={1.5} />Update Vitals</button>
          <button className="btn" onClick={onViewTrend}><BarChart3 size={18} strokeWidth={1.5} />Vitals Trend</button>
          <button className="btn" onClick={() => setShowOverride(!showOverride)}><AlertTriangle size={18} strokeWidth={1.5} />Override</button>
          <button className="btn btn-primary" onClick={() => onDischarge(p.id)}>Discharge</button>
        </div>

        {showOverride && (
          <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">Clinical Override</div>
            <div className="mb-2">
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-slate-400">New urgency</label>
              <select className="field" value={overrideLevel} onChange={(e) => setOverrideLevel(parseInt(e.target.value, 10))}>
                {URGENCY_LABELS.map((l, i) => (
                  <option key={i} value={i}>{l}</option>
                ))}
              </select>
            </div>
            <div className="mb-2">
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-slate-400">Clinical reason</label>
              <input className="field" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="e.g. Atypical MI presentation in elderly patient" />
            </div>
            <button className="btn btn-primary w-full" onClick={submitOverride}>Confirm Override</button>
          </div>
        )}
      </div>
    </div>
  );
}
