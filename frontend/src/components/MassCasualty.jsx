import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { TriangleAlert as AlertTriangle, Plus, Zap, ShieldAlert } from "lucide-react";

const BLANK = {
  name: "", age: 30, heart_rate: 90, systolic_bp: 110, diastolic_bp: 75,
  temperature: 37.5, oxygen_saturation: 95, respiratory_rate: 18,
  pain_score: 5, conscious_level: 1, arrival_mode: 1, chief_complaint: 2,
};

const MCI_LABELS = ["Immediate", "Urgent", "Less Urgent", "Non-Urgent"];
const MCI_COLORS = ["#f87171", "#fb923c", "#facc15", "#4ade80"];

export default function MassCasualty({ API, onDone }) {
  const [patients, setPatients] = useState([{ ...BLANK, name: "Victim 1" }]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const addPatient = () => setPatients(p => [...p, { ...BLANK, name: `Victim ${p.length + 1}` }]);
  const removePatient = (i) => setPatients(p => p.filter((_, idx) => idx !== i));
  const updatePatient = (i, key, val) => setPatients(p => p.map((pt, idx) => idx === i ? { ...pt, [key]: isNaN(val) ? val : Number(val) } : pt));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const r = await axios.post(`${API}/api/mass-casualty`, { patients });
      if (r.data.success) { setResults(r.data); toast.success(`MCI processed: ${r.data.processed} patients triaged`); onDone(); }
    } catch { toast.error("Backend not connected"); }
    setLoading(false);
  };

  return (
    <div>
      {/* MCI alert header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl mb-5 mci-glow"
        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", padding: "14px 18px" }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center rounded-lg shrink-0"
            style={{ width: 40, height: 40, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <AlertTriangle size={20} color="#f87171" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm tracking-widest uppercase mb-0.5" style={{ color: "#f87171", letterSpacing: "0.1em" }}>
              MASS CASUALTY INCIDENT MODE
            </div>
            <div className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>
              Process multiple patients simultaneously using START triage protocol. All patients added to queue instantly.
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            className="btn btn-danger shrink-0"
            style={{ fontSize: 13, padding: "10px 18px", borderRadius: 10 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            <Zap size={14} />
            {loading ? "Processing..." : `Triage All ${patients.length} Patients`}
          </motion.button>
        </div>
      </motion.div>

      {!results ? (
        <>
          <div className="flex items-center gap-3 mb-4">
            <button className="btn" onClick={addPatient}><Plus size={13} />Add Victim</button>
            <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              {patients.length} patient{patients.length !== 1 ? "s" : ""} queued for triage
            </span>
          </div>

          <div className="space-y-3" style={{ maxHeight: "calc(100vh - 290px)", overflowY: "auto" }}>
            <AnimatePresence>
              {patients.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="glass-card"
                >
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.55)", letterSpacing: "0.1em" }}>
                      Victim {i + 1}
                    </span>
                    <button className="btn" style={{ fontSize: 11, padding: "3px 10px", color: "#f87171" }} onClick={() => removePatient(i)}>
                      Remove
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div><label className="field-label">Name / Tag</label><input className="field" value={p.name} onChange={e => updatePatient(i, "name", e.target.value)} /></div>
                      <div><label className="field-label">Age (approx)</label><input className="field" type="number" value={p.age} onChange={e => updatePatient(i, "age", e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[{ k: "heart_rate", l: "HR" }, { k: "oxygen_saturation", l: "SpO2" }, { k: "systolic_bp", l: "BP" }, { k: "respiratory_rate", l: "RR" }].map(f => (
                        <div key={f.k}><label className="field-label">{f.l}</label><input className="field" type="number" value={p[f.k]} onChange={e => updatePatient(i, f.k, e.target.value)} /></div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="field-label">Conscious Level</label>
                        <select className="field" value={p.conscious_level} onChange={e => updatePatient(i, "conscious_level", e.target.value)}>
                          <option value={0}>Alert</option><option value={1}>Voice</option><option value={2}>Pain</option><option value={3}>Unresponsive</option>
                        </select>
                      </div>
                      <div>
                        <label className="field-label">Chief Complaint</label>
                        <select className="field" value={p.chief_complaint} onChange={e => updatePatient(i, "chief_complaint", e.target.value)}>
                          {["Chest Pain","Breathlessness","Trauma","Fever","Abdominal","Headache","Fracture","Minor"].map((c, idx) => <option key={idx} value={idx}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="text-center mb-5">
            <div className="font-mono text-[12px] mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Processed in &lt; 2 seconds</div>
            <div className="font-bold text-2xl">{results.processed} patients triaged</div>
          </div>

          {/* Summary bento */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: "Immediate",   val: results.summary.immediate,   idx: 0 },
              { label: "Urgent",      val: results.summary.urgent,      idx: 1 },
              { label: "Less Urgent", val: results.summary.less_urgent, idx: 2 },
              { label: "Non-Urgent",  val: results.summary.non_urgent,  idx: 3 },
            ].map(s => (
              <div key={s.label} className={`mci-${s.idx} rounded-xl text-center py-4`}>
                <div className="font-bold font-mono text-3xl leading-none mb-1" style={{ color: MCI_COLORS[s.idx] }}>{s.val}</div>
                <div className="font-mono text-[11px]" style={{ color: MCI_COLORS[s.idx], opacity: 0.7 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Priority list */}
          <div className="glass-card">
            <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}>Treatment Priority Order</span>
            </div>
            <div className="p-3 space-y-2" style={{ maxHeight: 400, overflowY: "auto" }}>
              {[...results.results].sort((a, b) => a.urgency_level - b.urgency_level).map((r, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="font-mono text-[11px] w-6 shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>#{i + 1}</span>
                  <span className={`pill-${r.urgency_level} shrink-0`}>{r.urgency_label}</span>
                  <span className="font-medium text-[13px] flex-1">{r.name}</span>
                  <div className="flex gap-1.5">
                    {r.resources_needed?.slice(0, 2).map((res, j) => <span key={j} className="chip">{res}</span>)}
                    {r.sepsis_flag && (
                      <span className="chip" style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5", borderColor: "rgba(239,68,68,0.25)" }}>
                        <ShieldAlert size={9} /> SEPSIS
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{r.confidence}%</span>
                </div>
              ))}
            </div>
          </div>

          <button className="btn w-full mt-4" onClick={() => setResults(null)}>New MCI Event</button>
        </motion.div>
      )}
    </div>
  );
}
