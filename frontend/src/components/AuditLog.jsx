import { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { ClipboardList, RefreshCw, ShieldAlert, CreditCard as Edit3, TrendingUp } from "lucide-react";

const ACTION_CONFIG = {
  triage:       { label: "AI Triage",     color: "#60a5fa", bg: "rgba(59,130,246,0.1)",   border: "rgba(59,130,246,0.25)" },
  override:     { label: "Override",      color: "#fb923c", bg: "rgba(249,115,22,0.1)",   border: "rgba(249,115,22,0.25)" },
  auto_upgrade: { label: "Auto Upgraded", color: "#f87171", bg: "rgba(239,68,68,0.1)",    border: "rgba(239,68,68,0.25)"  },
};

const URGENCY_COLORS = ["#f87171", "#fb923c", "#facc15", "#4ade80"];
const URGENCY_LABELS = ["Immediate", "Urgent", "Less Urgent", "Non-Urgent"];

const MOCK_LOG = [
  { timestamp: new Date(Date.now() - 300000).toISOString(), patient_id: "A1B2C3", patient_name: "Ravi Kumar", action: "triage", urgency_level: 0, confidence: 94.2, sepsis_flag: true, overridden: false, note: null },
  { timestamp: new Date(Date.now() - 240000).toISOString(), patient_id: "D4E5F6", patient_name: "Priya Sharma", action: "triage", urgency_level: 1, confidence: 81.5, sepsis_flag: false, overridden: false, note: null },
  { timestamp: new Date(Date.now() - 180000).toISOString(), patient_id: "D4E5F6", patient_name: "Priya Sharma", action: "override", urgency_level: 0, confidence: null, sepsis_flag: false, overridden: true, note: "Atypical MI presentation — upgrading to Immediate" },
  { timestamp: new Date(Date.now() - 120000).toISOString(), patient_id: "G7H8I9", patient_name: "Mohammed Farooq", action: "triage", urgency_level: 2, confidence: 67.3, sepsis_flag: false, overridden: false, note: null },
  { timestamp: new Date(Date.now() - 60000).toISOString(),  patient_id: "G7H8I9", patient_name: "Mohammed Farooq", action: "auto_upgrade", urgency_level: 1, confidence: null, sepsis_flag: false, overridden: false, note: "SpO2 dropping · HR rising" },
];

const rowVariants = {
  hidden:  { opacity: 0, x: -8 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { delay: i * 0.03, duration: 0.18 } }),
};

export default function AuditLog({ API }) {
  const [log, setLog]       = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchLog(); }, []);

  const fetchLog = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/audit`);
      if (r.data.success) setLog(r.data.log);
    } catch { setLog(MOCK_LOG); }
    setLoading(false);
  };

  const filtered = log.filter(entry => {
    const matchFilter = filter === "all" || entry.action === filter || (filter === "sepsis" && entry.sepsis_flag);
    const matchSearch = !search ||
      entry.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
      entry.patient_id?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const stats = {
    total:    log.length,
    overrides: log.filter(e => e.action === "override").length,
    sepsis:    log.filter(e => e.sepsis_flag).length,
    upgraded:  log.filter(e => e.action === "auto_upgrade").length,
  };

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Events",   value: stats.total,    cls: "stat-blue",   icon: ClipboardList },
          { label: "Nurse Overrides",value: stats.overrides,cls: "stat-orange", icon: Edit3         },
          { label: "Sepsis Flags",   value: stats.sepsis,   cls: "stat-red",    icon: ShieldAlert   },
          { label: "Auto Upgrades",  value: stats.upgraded, cls: "stat-yellow", icon: TrendingUp    },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }} className="glass-card p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Icon size={11} style={{ color: "rgba(255,255,255,0.3)" }} />
                <span className="field-label m-0">{s.label}</span>
              </div>
              <div className={`text-3xl font-bold font-mono leading-none ${s.cls}`}>{s.value}</div>
            </motion.div>
          );
        })}
      </div>

      <div className="glass-card">
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}>
            Audit Trail
          </span>
          <button className="btn" style={{ padding: "4px 10px", fontSize: 11 }} onClick={fetchLog}>
            <RefreshCw size={11} />Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <input
            className="field"
            style={{ maxWidth: 220 }}
            placeholder="Search patient name or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="tab-bar ml-1">
            {[
              { id: "all",          label: "All" },
              { id: "triage",       label: "Triage" },
              { id: "override",     label: "Overrides" },
              { id: "auto_upgrade", label: "Upgrades" },
              { id: "sepsis",       label: "Sepsis" },
            ].map(f => (
              <button key={f.id} className={`tab-btn ${filter === f.id ? "active" : ""}`} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <span className="ml-auto font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.28)" }}>{filtered.length} entries</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center" style={{ height: 120, color: "rgba(255,255,255,0.28)", fontSize: 13 }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center" style={{ height: 120, color: "rgba(255,255,255,0.28)", fontSize: 13 }}>
            No entries found. Start triaging patients to build the audit trail.
          </div>
        ) : (
          <div style={{ maxHeight: "calc(100vh - 360px)", overflowY: "auto" }}>
            {filtered.map((entry, i) => {
              const ac = ACTION_CONFIG[entry.action] || ACTION_CONFIG.triage;
              const urgencyColor = URGENCY_COLORS[entry.urgency_level] || "rgba(255,255,255,0.5)";
              const urgencyLabel = URGENCY_LABELS[entry.urgency_level] || "Unknown";
              const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--";

              return (
                <motion.div key={i} custom={i} variants={rowVariants} initial="hidden" animate="visible" className="audit-row">
                  <div className="font-mono text-[10px] shrink-0 w-12 mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{time}</div>

                  <div className="flex items-center shrink-0 mr-2">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: ac.bg, color: ac.color, border: `1px solid ${ac.border}` }}>
                      {ac.label}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-mono text-[10px]" style={{ color: "#60a5fa" }}>#{entry.patient_id}</span>
                      <span className="text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>{entry.patient_name}</span>
                    </div>
                    <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.38)" }}>
                      <span style={{ color: urgencyColor }}>{urgencyLabel}</span>
                      {entry.confidence && <span className="ml-2">· {entry.confidence}% conf.</span>}
                      {entry.note && <span className="ml-2">· {entry.note}</span>}
                    </div>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    {entry.sepsis_flag && (
                      <span className="chip" style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5", borderColor: "rgba(239,68,68,0.25)" }}>SEPSIS</span>
                    )}
                    {entry.overridden && (
                      <span className="chip" style={{ background: "rgba(249,115,22,0.1)", color: "#fdba74", borderColor: "rgba(249,115,22,0.25)" }}>OVERRIDE</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bias analysis */}
      <div className="glass-card mt-4">
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}>Override Pattern Analysis</span>
          <span className="chip">Bias Detection</span>
        </div>
        <div className="p-4">
          {stats.overrides === 0 ? (
            <div className="text-[13px]" style={{ color: "rgba(255,255,255,0.38)" }}>
              No overrides recorded yet. Override patterns will be analyzed here to detect systematic AI bias.
            </div>
          ) : (
            <div className="text-[13px]" style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.8 }}>
              <span className="font-bold" style={{ color: "#f1f5f9" }}>{stats.overrides}</span> AI decisions overridden out of{" "}
              <span className="font-bold" style={{ color: "#f1f5f9" }}>{stats.total}</span> total events
              ({Math.round((stats.overrides / stats.total) * 100)}% override rate).
              <div className="mt-2 p-3 rounded-lg text-[12px]" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.38)" }}>
                High override rates in specific demographics may indicate model bias. Review override reasons to identify patterns.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
