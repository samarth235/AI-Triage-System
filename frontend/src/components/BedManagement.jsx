import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { BedDouble, Building2, CircleAlert, DoorOpen, Hospital } from "lucide-react";

const BED_CONFIG = {
  icu: { label: "ICU", color: "rgb(248 113 113)" },
  emergency: { label: "Emergency", color: "rgb(251 146 60)" },
  general: { label: "General", color: "rgb(56 189 248)" },
  observation: { label: "Observation", color: "rgb(52 211 153)" },
};

function BedBar({ occupied, total, color }) {
  const pct = total > 0 ? (occupied / total) * 100 : 0;
  const fillColor = pct >= 90 ? "rgb(248 113 113)" : pct >= 70 ? "rgb(251 146 60)" : color;
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: fillColor }} />
      </div>
      <div className="mt-1 font-mono text-[11px] text-slate-300">{occupied}/{total} occupied ({Math.round(pct)}%)</div>
    </div>
  );
}

export default function BedManagement({ beds, API }) {
  const [loading, setLoading] = useState({});

  const update = async (type, action) => {
    setLoading((p) => ({ ...p, [type + action]: true }));
    try {
      await axios.post(`${API}/api/beds/update`, { type, action });
      toast.success(`${BED_CONFIG[type]?.label} bed ${action === "occupy" ? "marked occupied" : "freed"}`);
    } catch {
      toast.error("Backend not connected");
    }
    setLoading((p) => ({ ...p, [type + action]: false }));
  };

  const totalBeds = Object.values(beds).reduce((s, b) => s + (b.total || 0), 0);
  const totalOccupied = Object.values(beds).reduce((s, b) => s + (b.occupied || 0), 0);
  const totalFree = totalBeds - totalOccupied;
  const overallPct = totalBeds > 0 ? Math.round((totalOccupied / totalBeds) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Beds", val: totalBeds, sub: "Across all wards", cls: "text-sky-300", icon: Building2 },
          { label: "Occupied", val: totalOccupied, sub: `${overallPct}% capacity`, cls: "text-red-300", icon: Hospital },
          { label: "Available", val: totalFree, sub: "Ready for admission", cls: "text-emerald-300", icon: DoorOpen },
          { label: "Overall Load", val: `${overallPct}%`, sub: overallPct >= 90 ? "Critical" : overallPct >= 70 ? "High load" : "Normal", cls: overallPct >= 90 ? "text-red-300" : overallPct >= 70 ? "text-orange-300" : "text-emerald-300", icon: CircleAlert },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="glass-card p-4">
              <div className="mb-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500"><Icon size={18} strokeWidth={1.5} />{s.label}</div>
              <div className={`font-mono text-3xl font-semibold ${s.cls}`}>{s.val}</div>
              <div className="text-xs text-slate-400">{s.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {Object.entries(BED_CONFIG).map(([type, cfg]) => {
          const data = beds[type] || { total: 0, occupied: 0 };
          const free = data.total - data.occupied;
          const pct = data.total > 0 ? Math.round((data.occupied / data.total) * 100) : 0;
          const critical = pct >= 90;
          const warning = pct >= 70;
          const statusGlow = type === "icu" ? "shadow-status-red" : type === "emergency" ? "shadow-status-orange" : "";

          return (
            <div key={type} className={`glass-card border-white/15 ${statusGlow}`}>
              <div className="glass-head">
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <BedDouble size={18} strokeWidth={1.5} style={{ color: cfg.color }} />
                  {cfg.label} Ward
                </span>
                <span className={`card-badge ${critical ? "text-red-300" : warning ? "text-orange-300" : "text-slate-300"}`}>{critical ? "NEAR FULL" : `${free} free`}</span>
              </div>
              <div className="space-y-3 p-4">
                {critical && <div className="rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs text-red-200">Ward at {pct}% capacity - consider diversion protocol.</div>}
                <BedBar occupied={data.occupied} total={data.total} color={cfg.color} />

                <div className="grid grid-cols-8 gap-1">
                  {Array.from({ length: data.total }).map((_, i) => (
                    <div
                      key={i}
                      title={i < data.occupied ? "Occupied" : "Available"}
                      className="h-5 rounded"
                      style={{
                        background: i < data.occupied ? cfg.color : "rgba(51,65,85,.5)",
                        border: "1px solid rgba(255,255,255,.15)",
                        opacity: i < data.occupied ? 0.95 : 0.45,
                      }}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button className="btn" disabled={data.occupied >= data.total || loading[type + "occupy"]} onClick={() => update(type, "occupy")}>Admit Patient</button>
                  <button className="btn btn-primary" disabled={data.occupied <= 0 || loading[type + "free"]} onClick={() => update(type, "free")}>Free Bed</button>
                </div>

                <div className="flex justify-between text-xs text-slate-400">
                  <span>Occupied: <strong className="text-slate-100">{data.occupied}</strong></span>
                  <span>Available: <strong className="text-emerald-300">{free}</strong></span>
                  <span>Total: <strong className="text-slate-100">{data.total}</strong></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
