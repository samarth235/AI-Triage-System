import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { FileText, Download, ShieldAlert, TriangleAlert as AlertTriangle } from "lucide-react";

export default function ShiftHandover({ API, queue }) {
  const [form, setForm] = useState({ nurse: "", period: "Day Shift (08:00–20:00)", notes: "" });
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleGenerate = async () => {
    if (!form.nurse.trim()) { toast.error("Enter reporting nurse name"); return; }
    setLoading(true);
    try {
      const r = await axios.post(`${API}/api/handover`, form, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `shift_handover_${new Date().toISOString().slice(0, 16).replace("T", "_")}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      setGenerated(true);
      toast.success("Shift handover report downloaded!");
    } catch { toast.error("Backend not connected — ensure app.py is running"); }
    setLoading(false);
  };

  const counts = {
    immediate:   queue.filter(p => p.urgency_level === 0).length,
    urgent:      queue.filter(p => p.urgency_level === 1).length,
    less_urgent: queue.filter(p => p.urgency_level === 2).length,
    non_urgent:  queue.filter(p => p.urgency_level === 3).length,
    sepsis:      queue.filter(p => p.sepsis_flag).length,
    overridden:  queue.filter(p => p.overridden).length,
  };

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "360px 1fr" }}>
      {/* Form */}
      <div className="glass-card">
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2">
            <FileText size={13} style={{ color: "rgba(255,255,255,0.38)" }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}>
              Generate Handover
            </span>
          </div>
          <span className="chip">PDF</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="alert-uncertain text-[11px]">
            Generates a complete PDF shift handover report with all patients, stats, sepsis flags, and clinical notes.
          </div>

          <div><label className="field-label">Reporting Nurse / Doctor *</label><input className="field" value={form.nurse} onChange={e => set("nurse", e.target.value)} placeholder="Sr. Nurse Meera Iyer" /></div>

          <div>
            <label className="field-label">Shift Period</label>
            <select className="field" value={form.period} onChange={e => set("period", e.target.value)}>
              <option>Day Shift (08:00–20:00)</option>
              <option>Night Shift (20:00–08:00)</option>
              <option>Morning Shift (06:00–14:00)</option>
              <option>Evening Shift (14:00–22:00)</option>
              <option>Custom Period</option>
            </select>
          </div>

          <div>
            <label className="field-label">Notes for Incoming Team</label>
            <textarea className="field" style={{ height: 90, resize: "none" }} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Critical patient updates, pending investigations..." />
          </div>

          <motion.button whileTap={{ scale: 0.98 }} className="btn btn-primary w-full" style={{ padding: 11, fontSize: 13, borderRadius: 10 }} onClick={handleGenerate} disabled={loading}>
            <Download size={14} />
            {loading ? "Generating PDF..." : "Generate & Download PDF"}
          </motion.button>

          {generated && (
            <div className="text-[12px] p-3 rounded-lg" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)", color: "#86efac" }}>
              Report downloaded. Share with incoming nurse/doctor.
            </div>
          )}
        </div>
      </div>

      {/* Preview column */}
      <div className="space-y-4">
        {/* Queue snapshot */}
        <div className="glass-card">
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}>Current Queue Snapshot</span>
            <span className="chip">{queue.length} patients</span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { label: "Immediate",   count: counts.immediate,   color: "#f87171", border: "rgba(239,68,68,0.25)"  },
                { label: "Urgent",      count: counts.urgent,      color: "#fb923c", border: "rgba(249,115,22,0.25)" },
                { label: "Less Urgent", count: counts.less_urgent, color: "#facc15", border: "rgba(234,179,8,0.22)"  },
                { label: "Non-Urgent",  count: counts.non_urgent,  color: "#4ade80", border: "rgba(34,197,94,0.22)"  },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between rounded-lg px-3 py-2.5"
                  style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${s.border}` }}>
                  <span className="text-[12px]" style={{ color: s.color }}>{s.label}</span>
                  <span className="font-bold font-mono text-xl" style={{ color: s.color }}>{s.count}</span>
                </div>
              ))}
            </div>

            {counts.sepsis > 0 && (
              <div className="alert-sepsis mb-2">
                <ShieldAlert size={13} />
                {counts.sepsis} patient{counts.sepsis > 1 ? "s" : ""} with active sepsis flag
              </div>
            )}
            {counts.overridden > 0 && (
              <div className="alert-pain">
                <AlertTriangle size={13} />
                {counts.overridden} AI decision{counts.overridden > 1 ? "s" : ""} overridden — review clinical reasoning
              </div>
            )}
            {queue.length === 0 && (
              <div className="text-[13px] text-center py-2" style={{ color: "rgba(255,255,255,0.28)" }}>Queue is empty — clean handover</div>
            )}
          </div>
        </div>

        {/* Patient list */}
        {queue.length > 0 && (
          <div className="glass-card">
            <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}>Patients Requiring Handover</span>
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {[...queue].sort((a, b) => a.urgency_level - b.urgency_level).map(p => (
                <div key={p.id} className="audit-row">
                  <div className="font-mono text-[10px] w-12 shrink-0 mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{p.arrival_time}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`pill-${p.urgency_level}`}>{p.urgency_label}</span>
                      <span className="font-medium text-[12px]">{p.name}</span>
                      <span className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>#{p.id}</span>
                    </div>
                    <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.38)" }}>
                      Age {p.age} · {p.chief_complaint} · Wait: {p.max_wait}
                      {p.sepsis_flag && <span className="ml-2" style={{ color: "#fca5a5" }}>SEPSIS</span>}
                      {p.overridden  && <span className="ml-2" style={{ color: "#facc15" }}>OVERRIDDEN</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Report contents */}
        <div className="glass-card">
          <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}>Report Contents</span>
          </div>
          <div className="p-4 space-y-2">
            {[
              "Shift period and reporting nurse details",
              "Patient-wise urgency distribution stats",
              "All patients in queue with full details",
              "Sepsis flags and SIRS criteria summary",
              "Nurse override log with clinical reasons",
              "AI confidence scores and uncertain predictions",
              "Recommendations for incoming shift",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px]" style={{ color: "rgba(255,255,255,0.42)" }}>
                <span style={{ color: "#4ade80", fontSize: 10 }}>&#10003;</span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
