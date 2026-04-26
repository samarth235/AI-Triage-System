import { useState, useEffect } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TriangleAlert as AlertTriangle } from "lucide-react";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(17,29,53,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}>
      <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></div>
      ))}
    </div>
  );
};

export default function VitalsTrend({ patient, API }) {
  const [history, setHistory] = useState([]);
  const [trend, setTrend] = useState({});
  const [newHR, setNewHR] = useState("");
  const [newSPO2, setNewSPO2] = useState("");
  const [newBP, setNewBP] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchHistory(); }, [patient.id]);

  const fetchHistory = async () => {
    try {
      const r = await axios.get(`${API}/api/vitals/history/${patient.id}`);
      if (r.data.success) {
        setHistory(r.data.history.map((h, i) => ({ ...h, time: `T+${i * 15}m` })));
        setTrend(r.data.trend);
      }
    } catch {}
  };

  const addVitals = async () => {
    const vitals = {};
    if (newHR)   vitals.heart_rate        = parseInt(newHR);
    if (newSPO2) vitals.oxygen_saturation = parseInt(newSPO2);
    if (newBP)   vitals.systolic_bp       = parseInt(newBP);
    if (!Object.keys(vitals).length) return;
    setLoading(true);
    try {
      await axios.post(`${API}/api/vitals/update`, { patient_id: patient.id, vitals });
      setNewHR(""); setNewSPO2(""); setNewBP("");
      await fetchHistory();
    } catch {}
    setLoading(false);
  };

  return (
    <div>
      {trend.deteriorating && (
        <div className="alert-sepsis mb-4">
          <AlertTriangle size={13} />
          <span>DETERIORATING — {trend.signals?.join(", ")}</span>
        </div>
      )}

      {history.length >= 2 ? (
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: "12px 8px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "JetBrains Mono" }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "JetBrains Mono" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "JetBrains Mono", color: "rgba(255,255,255,0.5)" }} />
              <Line type="monotone" dataKey="heart_rate"        stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: "#ef4444" }} name="HR" />
              <Line type="monotone" dataKey="oxygen_saturation" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e" }} name="SpO2" />
              <Line type="monotone" dataKey="systolic_bp"       stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} name="BP Sys" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-xl" style={{ height: 140, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
          Add more vitals readings to see trend
        </div>
      )}

      <div className="mt-4">
        <div className="section-label mb-3">Add Vitals Reading</div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div><label className="field-label">Heart Rate</label><input className="field" type="number" value={newHR} onChange={e => setNewHR(e.target.value)} placeholder="bpm" /></div>
          <div><label className="field-label">SpO2 (%)</label><input className="field" type="number" value={newSPO2} onChange={e => setNewSPO2(e.target.value)} placeholder="%" /></div>
          <div><label className="field-label">Systolic BP</label><input className="field" type="number" value={newBP} onChange={e => setNewBP(e.target.value)} placeholder="mmHg" /></div>
        </div>
        <button className="btn btn-primary w-full" onClick={addVitals} disabled={loading}>
          {loading ? "Updating..." : "Log Vitals Reading"}
        </button>
      </div>
    </div>
  );
}
