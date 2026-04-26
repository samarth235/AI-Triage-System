import { motion, AnimatePresence } from "framer-motion";
import { Users, Clock, CircleAlert as AlertCircle } from "lucide-react";

const GLOW_CLASSES = ["glow-red", "glow-orange", "glow-yellow", "glow-green"];
const URGENCY_DOT = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-400"];
const WAIT_COLORS = ["#f87171", "#fb923c", "#facc15", "#4ade80"];

export default function PatientQueue({ queue, selected, onSelect, onDischarge }) {
  if (!queue.length) return (
    <div className="glass-card flex flex-col items-center justify-center" style={{ minHeight: 420 }}>
      <div className="rounded-full mb-3 flex items-center justify-center"
        style={{ width: 48, height: 48, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <Users size={20} style={{ color: "rgba(255,255,255,0.18)" }} />
      </div>
      <div className="text-sm font-semibold mb-1" style={{ color: "rgba(255,255,255,0.28)" }}>Queue Empty</div>
      <div className="text-xs" style={{ color: "rgba(255,255,255,0.18)" }}>Register a patient using the form</div>
    </div>
  );

  return (
    <div className="glass-card flex flex-col" style={{ maxHeight: "calc(100vh - 200px)" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2">
          <Users size={13} style={{ color: "rgba(255,255,255,0.38)" }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em" }}>
            Live Queue
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 live-dot" />
          {queue.length} patients
        </div>
      </div>

      <div className="overflow-y-auto flex-1 p-3 space-y-2">
        <AnimatePresence>
          {queue.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
              className={`rounded-xl cursor-pointer transition-all duration-150 ${GLOW_CLASSES[p.urgency_level]} ${selected?.id === p.id ? "ring-1 ring-blue-500/40" : ""}`}
              style={{
                background: selected?.id === p.id ? "rgba(59,130,246,0.06)" : "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                padding: "11px 13px",
              }}
              onClick={() => onSelect(p)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`pill-${p.urgency_level}`}>{p.urgency_label}</span>
                  <span className="font-semibold text-[13px]" style={{ color: "#f1f5f9" }}>{p.name}</span>
                  {p.age_group !== "adult" && (
                    <span className={p.age_group === "pediatric" ? "age-pediatric" : "age-geriatric"}>{p.age_group}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <Clock size={10} style={{ color: "rgba(255,255,255,0.28)" }} />
                  <span className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{p.arrival_time}</span>
                </div>
              </div>

              <div className="text-[11px] mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                Age {p.age} · {p.chief_complaint}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <div className="chip">
                  <div className={`w-1.5 h-1.5 rounded-full ${URGENCY_DOT[p.urgency_level]}`} />
                  <span style={{ color: WAIT_COLORS[p.urgency_level] }}>Wait: {p.max_wait}</span>
                </div>
                <div className="chip">{Math.round(p.confidence)}% conf.</div>
                {p.sepsis_flag && (
                  <div className="chip" style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5", borderColor: "rgba(239,68,68,0.25)" }}>
                    <AlertCircle size={9} /> SEPSIS
                  </div>
                )}
                {p.uncertain && (
                  <div className="chip" style={{ background: "rgba(59,130,246,0.08)", color: "#93c5fd", borderColor: "rgba(59,130,246,0.2)" }}>
                    UNCERTAIN
                  </div>
                )}
                {p.overridden && <div className="chip" style={{ color: "#facc15" }}>OVERRIDDEN</div>}
                {p.source === "ambulance" && <div className="chip" style={{ background: "rgba(249,115,22,0.08)", color: "#fdba74" }}>AMB</div>}
                {p.source === "mass_casualty" && <div className="chip" style={{ background: "rgba(59,130,246,0.08)", color: "#93c5fd" }}>MCI</div>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
