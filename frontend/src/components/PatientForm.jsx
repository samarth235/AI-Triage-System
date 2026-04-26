import { useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Zap, User } from "lucide-react";

const COMPLAINTS = [
  "Chest Pain", "Breathlessness", "Trauma / Injury", "Fever",
  "Abdominal Pain", "Headache", "Fracture", "Minor Injury",
];

const DEFAULTS = {
  name: "", age: 45, heart_rate: 80, systolic_bp: 120, diastolic_bp: 80,
  temperature: 37.0, oxygen_saturation: 98, respiratory_rate: 16,
  pain_score: 3, conscious_level: 0, arrival_mode: 0, chief_complaint: 3,
  complaint_text: "",
};

const getAgeGroup = (age) => age <= 12 ? "pediatric" : age >= 65 ? "geriatric" : "adult";

export default function PatientForm({ API, onPatientAdded }) {
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [nlpResult, setNlpResult] = useState(null);
  const [nlpLoading, setNlpLoading] = useState(false);

  const ageGroup = getAgeGroup(form.age);
  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const parseComplaint = async (text) => {
    if (!text || text.length < 4) return;
    setNlpLoading(true);
    try {
      const r = await axios.post(`${API}/api/parse-complaint`, { text });
      if (r.data.success) { setNlpResult(r.data.result); set("chief_complaint", r.data.result.category_id); }
    } catch {}
    setNlpLoading(false);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { alert("Enter patient name"); return; }
    setLoading(true);
    try {
      const payload = { ...form };
      delete payload.complaint_text;
      const r = await axios.post(`${API}/api/triage`, payload);
      if (r.data.success) { onPatientAdded(r.data.patient); setForm({ ...DEFAULTS }); setNlpResult(null); }
    } catch { alert("Backend not connected. Run app.py first."); }
    setLoading(false);
  };

  return (
    <div className="glass-card flex flex-col" style={{ maxHeight: "calc(100vh - 200px)" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2">
          <User size={13} style={{ color: "rgba(255,255,255,0.38)" }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}>
            Register Patient
          </span>
        </div>
        <span className={ageGroup === "pediatric" ? "age-pediatric" : ageGroup === "geriatric" ? "age-geriatric" : "age-adult"}>
          {ageGroup.toUpperCase()}
        </span>
      </div>

      <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
        <div>
          <label className="field-label">Patient Name *</label>
          <input className="field" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Full name" />
        </div>

        <div>
          <label className="field-label">Chief Complaint (free text)</label>
          <input
            className="field"
            value={form.complaint_text}
            onChange={e => { set("complaint_text", e.target.value); parseComplaint(e.target.value); }}
            placeholder="e.g. severe chest pain with left arm pain"
          />
          {nlpLoading && <div className="text-[10px] mt-1.5 font-mono" style={{ color: "rgba(255,255,255,0.28)" }}>Parsing...</div>}
          {nlpResult && (
            <div className="nlp-card mt-1.5">
              Detected: <strong>{nlpResult.category_label}</strong> ({nlpResult.confidence}% conf.)
              {nlpResult.urgency_hint === "high" && <span className="ml-2 font-semibold" style={{ color: "#f87171" }}>HIGH URGENCY</span>}
            </div>
          )}
        </div>

        <div>
          <label className="field-label">Complaint Category</label>
          <select className="field" value={form.chief_complaint} onChange={e => set("chief_complaint", parseInt(e.target.value))}>
            {COMPLAINTS.map((c, i) => <option key={i} value={i}>{c}</option>)}
          </select>
        </div>

        {ageGroup === "pediatric" && (
          <div className="alert-uncertain text-[11px]">
            Pediatric Mode: HR normal range 70–120 bpm. FLACC pain scale active.
          </div>
        )}
        {ageGroup === "geriatric" && (
          <div style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.18)", borderRadius: 8, padding: "7px 11px", fontSize: 11, color: "#d8b4fe" }}>
            Geriatric Mode: Lower pain threshold. BP &lt;110 systolic flagged.
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div><label className="field-label">Age</label><input className="field" type="number" value={form.age} onChange={e => set("age", parseInt(e.target.value))} min="1" max="110" /></div>
          <div><label className="field-label">Pain (0–10)</label><input className="field" type="number" value={form.pain_score} onChange={e => set("pain_score", parseInt(e.target.value))} min="0" max="10" /></div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div><label className="field-label">Heart Rate (bpm)</label><input className="field" type="number" value={form.heart_rate} onChange={e => set("heart_rate", parseInt(e.target.value))} /></div>
          <div><label className="field-label">SpO2 (%)</label><input className="field" type="number" value={form.oxygen_saturation} onChange={e => set("oxygen_saturation", parseInt(e.target.value))} min="50" max="100" /></div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div><label className="field-label">Systolic BP</label><input className="field" type="number" value={form.systolic_bp} onChange={e => set("systolic_bp", parseInt(e.target.value))} /></div>
          <div><label className="field-label">Diastolic BP</label><input className="field" type="number" value={form.diastolic_bp} onChange={e => set("diastolic_bp", parseInt(e.target.value))} /></div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div><label className="field-label">Temp (°C)</label><input className="field" type="number" step="0.1" value={form.temperature} onChange={e => set("temperature", parseFloat(e.target.value))} /></div>
          <div><label className="field-label">Resp. Rate (/min)</label><input className="field" type="number" value={form.respiratory_rate} onChange={e => set("respiratory_rate", parseInt(e.target.value))} /></div>
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
            <label className="field-label">Arrival Mode</label>
            <select className="field" value={form.arrival_mode} onChange={e => set("arrival_mode", parseInt(e.target.value))}>
              <option value={0}>Walk-in</option><option value={1}>Ambulance</option><option value={2}>Police</option>
            </select>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          className="btn btn-danger w-full"
          style={{ padding: "11px", fontSize: 13, borderRadius: 10 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          <Zap size={14} />
          {loading ? "Triaging..." : "Triage Patient"}
        </motion.button>
      </div>
    </div>
  );
}
