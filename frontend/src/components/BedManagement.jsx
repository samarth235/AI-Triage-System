import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

const BED_CONFIG = {
  icu:         { label: "ICU",         accent: "#ef4444", dim: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)"  },
  emergency:   { label: "Emergency",   accent: "#f97316", dim: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)" },
  general:     { label: "General",     accent: "#3b82f6", dim: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)" },
  observation: { label: "Observation", accent: "#22c55e", dim: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.28)" },
};

const cardVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.25 } }),
};

export default function BedManagement({ beds, API }) {
  const [loading, setLoading] = useState({});

  const update = async (type, action) => {
    setLoading(p => ({ ...p, [type + action]: true }));
    try {
      await axios.post(`${API}/api/beds/update`, { type, action });
      toast.success(`${BED_CONFIG[type]?.label} bed ${action === "occupy" ? "admitted" : "freed"}`);
    } catch { toast.error("Backend not connected"); }
    setLoading(p => ({ ...p, [type + action]: false }));
  };

  const totalBeds     = Object.values(beds).reduce((s, b) => s + (b.total    || 0), 0);
  const totalOccupied = Object.values(beds).reduce((s, b) => s + (b.occupied || 0), 0);
  const totalFree     = totalBeds - totalOccupied;
  const overallPct    = totalBeds > 0 ? Math.round((totalOccupied / totalBeds) * 100) : 0;
  const overallColor  = overallPct >= 90 ? "#f87171" : overallPct >= 70 ? "#fb923c" : "#4ade80";

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Beds",   value: totalBeds,     sub: "All wards",       cls: "stat-blue"   },
          { label: "Occupied",     value: totalOccupied, sub: `${overallPct}% capacity`, cls: "stat-red" },
          { label: "Available",    value: totalFree,     sub: "Ready now",       cls: "stat-green"  },
          { label: "Overall Load", value: `${overallPct}%`, sub: overallPct >= 90 ? "Critical" : overallPct >= 70 ? "High load" : "Normal", cls: overallPct >= 90 ? "stat-red" : overallPct >= 70 ? "stat-orange" : "stat-green" },
        ].map((s, i) => (
          <motion.div key={s.label} custom={i} variants={cardVariants} initial="hidden" animate="visible" className="glass-card p-4">
            <div className="field-label mb-2">{s.label}</div>
            <div className={`text-3xl font-bold font-mono leading-none mb-1 ${s.cls}`}>{s.value}</div>
            <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.32)" }}>{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Bento grid of ward cards */}
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(BED_CONFIG).map(([type, cfg], i) => {
          const data    = beds[type] || { total: 0, occupied: 0 };
          const free    = data.total - data.occupied;
          const pct     = data.total > 0 ? Math.round((data.occupied / data.total) * 100) : 0;
          const critical = pct >= 90;
          const barColor = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f97316" : cfg.accent;

          return (
            <motion.div
              key={type}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="glass-card"
              style={{
                border: `1px solid ${critical ? "rgba(239,68,68,0.35)" : cfg.border}`,
                boxShadow: critical
                  ? "0 0 24px rgba(239,68,68,0.15), inset 0 1px 0 rgba(239,68,68,0.1)"
                  : `0 0 16px ${cfg.accent}22`,
              }}
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: cfg.accent, boxShadow: `0 0 6px ${cfg.accent}` }} />
                  <span className="font-bold text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.7)", letterSpacing: "0.1em" }}>
                    {cfg.label}
                  </span>
                </div>
                <div className="font-mono text-xs font-semibold" style={{ color: critical ? "#f87171" : "rgba(255,255,255,0.4)" }}>
                  {critical ? "NEAR FULL" : `${free} free`}
                </div>
              </div>

              <div className="p-4">
                {critical && (
                  <div className="alert-sepsis mb-3 text-[11px]">
                    {cfg.label} at {pct}% capacity — consider diversion
                  </div>
                )}

                {/* Capacity bar */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>Capacity</span>
                  <span className="font-mono text-[12px] font-bold" style={{ color: barColor }}>
                    {data.occupied}/{data.total}
                  </span>
                </div>
                <div className="bed-bar-track">
                  <motion.div
                    className="bed-bar-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    style={{ background: `linear-gradient(90deg, ${barColor}88, ${barColor})` }}
                  />
                </div>

                {/* Visual bed grid */}
                <div className="flex flex-wrap gap-1 my-3">
                  {Array.from({ length: data.total }).map((_, j) => (
                    <div
                      key={j}
                      title={j < data.occupied ? "Occupied" : "Available"}
                      style={{
                        width: 18, height: 18, borderRadius: 4,
                        background: j < data.occupied ? cfg.accent : "rgba(255,255,255,0.05)",
                        border: `1px solid ${j < data.occupied ? cfg.accent : "rgba(255,255,255,0.08)"}`,
                        opacity: j < data.occupied ? 0.85 : 0.4,
                        transition: "all 0.2s",
                      }}
                    />
                  ))}
                </div>

                {/* Stats row */}
                <div className="flex justify-between text-[11px] font-mono mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
                  <span>Occupied: <strong style={{ color: cfg.accent }}>{data.occupied}</strong></span>
                  <span>Free: <strong style={{ color: "#4ade80" }}>{free}</strong></span>
                  <span>Total: <strong style={{ color: "rgba(255,255,255,0.6)" }}>{data.total}</strong></span>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: 11 }}
                    disabled={data.occupied >= data.total || loading[type + "occupy"]}
                    onClick={() => update(type, "occupy")}
                  >
                    Admit Patient
                  </button>
                  <button
                    className="btn btn-success"
                    style={{ fontSize: 11 }}
                    disabled={data.occupied <= 0 || loading[type + "free"]}
                    onClick={() => update(type, "free")}
                  >
                    Free Bed
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Resource matching guide */}
      <div className="glass-card mt-4">
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}>
            Resource Matching Guide
          </span>
        </div>
        <div className="grid grid-cols-4 gap-3 p-4">
          {[
            { level: "Immediate",   ward: "ICU / Emergency", color: "#f87171", note: "Direct admit, no waiting" },
            { level: "Urgent",      ward: "Emergency",        color: "#fb923c", note: "Within 10 min, monitored" },
            { level: "Less Urgent", ward: "General / Obs",   color: "#facc15", note: "Within 60 min, standard" },
            { level: "Non-Urgent",  ward: "Waiting Area",    color: "#4ade80", note: "No bed needed immediately" },
          ].map((r, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "10px 12px" }}>
              <div className="font-mono text-[10px] font-bold mb-1" style={{ color: r.color }}>{r.level}</div>
              <div className="text-[12px] font-medium mb-1" style={{ color: "rgba(255,255,255,0.65)" }}>{r.ward}</div>
              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.32)" }}>{r.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
