import { Ambulance, BrainCircuit, Clock3, Thermometer, TriangleAlert, UserRound } from "lucide-react";

const urgencyStyles = [
  "border-red-400/40 bg-red-500/10",
  "border-orange-400/40 bg-orange-500/10",
  "border-yellow-400/40 bg-yellow-500/10",
  "border-emerald-400/40 bg-emerald-500/10",
];

export default function PatientQueue({ queue, selected, onSelect }) {
  if (!queue.length) {
    return (
      <div className="glass-card">
        <div className="glass-head">
          <span className="card-title">Live Queue</span>
          <span className="card-badge">Empty</span>
        </div>
        <div className="p-10 text-center text-sm text-slate-400">No patients in queue. Register a patient to begin triage.</div>
      </div>
    );
  }

  return (
    <div className="glass-card">
      <div className="glass-head">
        <span className="card-title">Live Queue</span>
        <span className="card-badge">{queue.length} patients</span>
      </div>
      <div className="max-h-[540px] space-y-2 overflow-y-auto p-3">
        {queue.map((p) => {
          const selectedState = selected?.id === p.id;
          return (
            <div
              key={p.id}
              className={`cursor-pointer rounded-lg border p-3 transition ${urgencyStyles[p.urgency_level]} ${selectedState ? "ring-1 ring-[var(--accent)]" : "hover:border-white/40"}`}
              onClick={() => onSelect(p)}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-white/15 bg-slate-950/50 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-slate-200">{p.urgency_label}</span>
                  <span className="text-sm font-medium text-slate-100">{p.name}</span>
                </div>
                <span className="flex items-center gap-1 font-mono text-[11px] text-zinc-500"><Clock3 size={18} strokeWidth={1.5} />{p.arrival_time}</span>
              </div>

              <div className="mb-2 flex items-center gap-2 text-xs text-slate-300">
                <UserRound size={18} strokeWidth={1.5} />
                Age {p.age} - {p.chief_complaint}
              </div>

              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <span className="rounded-full border border-white/15 bg-slate-950/50 px-2 py-1 text-slate-300">Wait: {p.max_wait}</span>
                <span className="rounded-full border border-white/15 bg-slate-950/50 px-2 py-1 font-mono text-slate-300">{Math.round(p.confidence)}% conf.</span>
                {p.sepsis_flag && <span className="inline-flex items-center gap-1 rounded-full border border-red-400/35 bg-red-500/15 px-2 py-1 text-red-200"><TriangleAlert size={18} strokeWidth={1.5} />SEPSIS</span>}
                {p.uncertain && <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/35 bg-violet-500/15 px-2 py-1 text-violet-200"><BrainCircuit size={18} strokeWidth={1.5} />UNCERTAIN</span>}
                {p.source === "ambulance" && <span className="inline-flex items-center gap-1 rounded-full border border-orange-400/35 bg-orange-500/15 px-2 py-1 text-orange-200"><Ambulance size={18} strokeWidth={1.5} />AMB</span>}
                {p.source === "mass_casualty" && <span className="rounded-full border border-red-400/35 bg-red-500/15 px-2 py-1 text-red-200">MCI</span>}
                {p.overridden && <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/35 bg-yellow-500/15 px-2 py-1 text-yellow-200"><Thermometer size={18} strokeWidth={1.5} />OVERRIDDEN</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
