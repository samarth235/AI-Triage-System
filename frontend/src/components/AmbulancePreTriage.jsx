import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Truck, Send, ShieldAlert } from "lucide-react";

const DEFAULTS = {
  name: "", age: 40, heart_rate: 90, systolic_bp: 110, diastolic_bp: 75,
  temperature: 37.5, oxygen_saturation: 95, respiratory_rate: 18,
  pain_score: 6, conscious_level: 1, chief_complaint: 0, eta_minutes: 5,
  paramedic_notes: "",
};

const URGENCY_COLORS = { Immediate: "#f87171", Urgent: "#fb923c", "Less Urgent": "#facc15", "Non-Urgent": "#4ade80" };

export default function AmbulancePreTriage({ API }) {
  const [form, setForm] = useState(DEFAULTS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error("Enter patient name"); return; }
    setLoading(true);
    try {
      const r = await axios.post(`${API}/api/ambulance/pretriage`, form);
      if (r.data.success) { setResult(r.data.pre_alert); toast.success("Pre-triage alert sent to ER team!"); }
    } catch { toast.error("Backend not connected"); }
    setLoading(false);
  };

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "360px 1fr" }}>
      {/* Form */}
      <div className="glass-card flex flex-col" style={{ maxHeight: "calc(100vh - 140px)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2">
            <Truck size={13} style={{ color: "rgba(255,255,255,0.38)" }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}>
              Ambulance Pre-Triage
            </span>
          </div>
          <span className="chip">Field Submission</span>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          <div className="alert-pain text-[11px]">
            Paramedics submit vitals from field. ER team gets alert before patient arrives.
          </div>

          <div><label className="field-label">Patient Name</label><input className="field" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Field name / Unknown" /></div>

          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Age (approx)</label><input className="field" type="number" value={form.age} onChange={e => set("age", parseInt(e.target.value))} /></div>
            <div><label className="field-label">ETA (minutes)</label><input className="field" type="number" value={form.eta_minutes} onChange={e => set("eta_minutes", parseInt(e.target.value))} /></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Heart Rate</label><input className="field" type="number" value={form.heart_rate} onChange={e => set("heart_rate", parseInt(e.target.value))} /></div>
            <div><label className="field-label">SpO2 (%)</label><input className="field" type="number" value={form.oxygen_saturation} onChange={e => set("oxygen_saturation", parseInt(e.target.value))} /></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Systolic BP</label><input className="field" type="number" value={form.systolic_bp} onChange={e => set("systolic_bp", parseInt(e.target.value))} /></div>
            <div><label className="field-label">Resp. Rate</label><input className="field" type="number" value={form.respiratory_rate} onChange={e => set("respiratory_rate", parseInt(e.target.value))} /></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Temp (°C)</label><input className="field" type="number" step="0.1" value={form.temperature} onChange={e => set("temperature", parseFloat(e.target.value))} /></div>
            <div><label className="field-label">Pain Score</label><input className="field" type="number" value={form.pain_score} onChange={e => set("pain_score", parseInt(e.target.value))} min="0" max="10" /></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Conscious Level</label>
              <select className="field" value={form.conscious_level} onChange={e => set("conscious_level", parseInt(e.target.value))}>
                <option value={0}>Alert</option><option value={1}>Voice</option>
                <option value={2}>Pain</option><option value={3}>Unresponsive</option>
              </select>
            </div>
            <div>
              <label className="field-label">Chief Complaint</label>
              <select className="field" value={form.chief_complaint} onChange={e => set("chief_complaint", parseInt(e.target.value))}>
                {["Chest Pain","Breathlessness","Trauma","Fever","Abdominal","Headache","Fracture","Minor"].map((c, i) => <option key={i} value={i}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label">Paramedic Notes</label>
            <textarea className="field" style={{ height: 70, resize: "none" }} value={form.paramedic_notes} onChange={e => set("paramedic_notes", e.target.value)} placeholder="Scene, mechanism of injury, interventions..." />
          </div>

          <motion.button whileTap={{ scale: 0.98 }} className="btn btn-warning w-full" style={{ padding: 11, fontSize: 13, borderRadius: 10 }} onClick={handleSubmit} disabled={loading}>
            <Send size={14} />
            {loading ? "Sending..." : "Send Pre-Triage Alert to ER"}
          </motion.button>
        </div>
      </div>

      {/* Result / info */}
      <div>
        {result ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}>Pre-Alert Sent</span>
              <span className="chip font-mono">{result.id}</span>
            </div>
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="font-bold font-mono text-5xl leading-none mb-2" style={{ color: URGENCY_COLORS[result.urgency_label] }}>
                  {result.urgency_label}
                </div>
                <div className="text-[13px]" style={{ color: "rgba(255,255,255,0.38)" }}>
                  ETA: {result.eta_minutes} min · {result.confidence}% confidence
                </div>
              </div>

              <div className="section-label">ER Preparation Required</div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {result.resources_needed?.map((r, i) => <span key={i} className="chip">{r}</span>)}
              </div>

              {result.sepsis_flag && (
                <div className="alert-sepsis mb-4">
                  <ShieldAlert size={13} />
                  SEPSIS PROTOCOL — Prepare IV access, blood culture trays, antibiotics
                </div>
              )}

              <div className="section-label">Field Vitals</div>
              <div className="vitals-grid">
                <div className="vital-box"><div className="vital-val">{result.vitals?.heart_rate}</div><div className="vital-lbl">HR bpm</div></div>
                <div className="vital-box"><div className="vital-val">{result.vitals?.oxygen_saturation}%</div><div className="vital-lbl">SpO2</div></div>
                <div className="vital-box"><div className="vital-val">{result.vitals?.systolic_bp}</div><div className="vital-lbl">BP Sys</div></div>
                <div className="vital-box"><div className="vital-val">{result.vitals?.temperature}°</div><div className="vital-lbl">Temp</div></div>
                <div className="vital-box"><div className="vital-val">{result.vitals?.respiratory_rate}</div><div className="vital-lbl">RR /min</div></div>
                <div className="vital-box"><div className="vital-val">{result.vitals?.pain_score}/10</div><div className="vital-lbl">Pain</div></div>
              </div>

              <button className="btn w-full mt-4" onClick={() => setResult(null)}>Send Another</button>
            </div>
          </motion.div>
        ) : (
          <div className="glass-card">
            <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}>How Pre-Triage Works</span>
            </div>
            <div className="p-5 space-y-3">
              {[
                "Paramedic submits vitals from ambulance",
                "AI predicts urgency level instantly",
                "ER team gets real-time WebSocket notification",
                "Resources prepared before patient arrives",
                "Patient added to queue on ER arrival",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="font-mono text-[11px] font-bold shrink-0 mt-0.5" style={{ color: "#60a5fa" }}>{i + 1}</div>
                  <div className="text-[13px]" style={{ color: "rgba(255,255,255,0.5)" }}>{step}</div>
                </div>
              ))}
              <div className="mt-3 p-3 rounded-lg text-[11px]" style={{ background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.2)", color: "#fdba74" }}>
                Preparation time increases from 2 min to 10–15 min before patient arrives
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
