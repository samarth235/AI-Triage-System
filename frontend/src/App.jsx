import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, AlertTriangle, BedDouble, ClipboardList, Radio, Siren, Stethoscope, Truck } from "lucide-react";
import PatientForm from "./components/PatientForm";
import PatientQueue from "./components/PatientQueue";
import DetailPanel from "./components/DetailPanel";
import BedManagement from "./components/BedManagement";
import AuditLog from "./components/AuditLog";
import MassCasualty from "./components/MassCasualty";
import AmbulancePreTriage from "./components/AmbulancePreTriage";
import ShiftHandover from "./components/ShiftHandover";
import VitalsTrend from "./components/VitalsTrend";

const getApiBase = () => {
  const envBase = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
  if (envBase) return envBase;
  if (typeof window !== "undefined" && window.location.port === "3000") return "http://localhost:5001";
  return "";
};

const API = getApiBase();
const socket = io(API || undefined, { path: "/socket.io", transports: ["websocket", "polling"] });

const TABS = [
  { id: "queue", label: "Live Queue", icon: Activity },
  { id: "ambulance", label: "Ambulance", icon: Truck },
  { id: "mass", label: "Mass Casualty", icon: Siren },
  { id: "beds", label: "Wards", icon: BedDouble },
  { id: "audit", label: "Audit Log", icon: ClipboardList },
  { id: "handover", label: "Handover", icon: Stethoscope },
];

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function App() {
  const [tab, setTab] = useState("queue");
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({ total: 0, immediate: 0, urgent: 0, less_urgent: 0, non_urgent: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [trendPatientId, setTrendPatientId] = useState(null);
  const [ambulanceAlert, setAmbulanceAlert] = useState(null);
  const [beds, setBeds] = useState({});
  const [mciMode, setMciMode] = useState(false);
  const selected = queue.find((patient) => patient.id === selectedId) || null;
  const trendPatient = queue.find((patient) => patient.id === trendPatientId) || null;

  useEffect(() => {
    socket.on("queue_update", ({ queue, stats }) => {
      setQueue(queue);
      setStats(stats);
    });
    socket.on("ambulance_incoming", (alert) => {
      setAmbulanceAlert(alert);
      toast(`Ambulance incoming: ${alert.patient_name} - ${alert.urgency_label}`, { duration: 8000 });
    });
    socket.on("patient_upgraded", () => {
      toast.error("Patient auto-upgraded due to deteriorating vitals", { duration: 6000 });
    });
    socket.on("retriage_alerts", (alerts) => {
      alerts.forEach((a) => toast(`Re-assess: ${a.name} has waited ${a.waited_minutes}m (limit: ${a.limit}m)`, { duration: 5000 }));
    });
    socket.on("bed_update", setBeds);

    fetchQueue();
    fetchBeds();
    return () => {
      socket.off("queue_update");
      socket.off("ambulance_incoming");
      socket.off("patient_upgraded");
      socket.off("retriage_alerts");
      socket.off("bed_update");
    };
  }, []);

  const fetchQueue = async () => {
    try {
      const r = await axios.get(`${API}/api/queue`);
      if (r.data.success) {
        setQueue(r.data.queue);
        setStats(r.data.stats);
      }
    } catch {
      toast.error("Unable to load patient queue");
    }
  };

  const fetchBeds = async () => {
    try {
      const r = await axios.get(`${API}/api/beds`);
      if (r.data.success) setBeds(r.data.beds);
    } catch {
      toast.error("Unable to load bed status");
    }
  };

  const handleDischarge = async (id) => {
    try {
      await axios.post(`${API}/api/discharge`, { patient_id: id });
      if (selectedId === id) setSelectedId(null);
      if (trendPatientId === id) setTrendPatientId(null);
      toast.success("Patient discharged");
    } catch {
      toast.error("Failed to discharge patient");
    }
  };

  const handleOverride = async (id, level, reason) => {
    try {
      await axios.post(`${API}/api/override`, { patient_id: id, new_urgency_level: level, reason });
      toast.success("Triage decision overridden");
      fetchQueue();
    } catch {
      toast.error("Failed to override triage");
    }
  };

  const handlePatientAdded = (patient) => {
    setQueue((prev) => [...prev, patient].sort((a, b) => a.urgency_level - b.urgency_level));
    setSelectedId(patient.id);
    toast.success(`Patient triaged: ${patient.urgency_label}`);
  };

  useEffect(() => {
    if (selectedId && !queue.some((patient) => patient.id === selectedId)) setSelectedId(null);
    if (trendPatientId && !queue.some((patient) => patient.id === trendPatientId)) setTrendPatientId(null);
  }, [queue, selectedId, trendPatientId]);

  const accent = mciMode ? "#ef4444" : "#10b981";

  return (
    <div className={`min-h-screen ${mciMode ? "mci" : ""}`} style={{ "--accent": accent }}>
      <Toaster position="top-right" toastOptions={{ style: { background: "#0f172a", color: "#f8fafc", border: "1px solid rgba(255,255,255,.12)" } }} />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/45 px-4 py-3 backdrop-blur-md md:px-6">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-3">
          <div className="mr-4 flex items-center gap-3">
            <div className={`rounded-xl border border-white/10 p-2 ${mciMode ? "bg-red-500/20" : "bg-emerald-500/15 animate-alert-pulse"}`}>
              <Radio strokeWidth={1.5} size={18} className={mciMode ? "text-red-300" : "text-emerald-300"} />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">Crisis Response Command Center</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Hospitality Incident Operations Grid</div>
            </div>
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} className={`btn px-3 py-1.5 ${active ? "border-transparent bg-white/15 text-white" : "bg-transparent text-slate-300"}`}>
                  <Icon strokeWidth={1.5} size={18} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <button onClick={() => setMciMode((v) => !v)} className={`btn ${mciMode ? "border-red-400/40 bg-red-500/20 text-red-200" : "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"}`}>
            <AlertTriangle strokeWidth={1.5} size={18} className={mciMode ? "" : "animate-alert-pulse"} />
            {mciMode ? "MCI MODE ACTIVE" : "Enable MCI Mode"}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6">
        {ambulanceAlert && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/50 bg-red-500/15 px-4 py-3 text-sm text-red-100">
            <Truck strokeWidth={1.5} size={18} />
            <strong>INCOMING:</strong> {ambulanceAlert.patient_name} · Age {ambulanceAlert.age} · {ambulanceAlert.urgency_label} · ETA {ambulanceAlert.eta_minutes} min
            <button className="btn ml-auto" onClick={() => setAmbulanceAlert(null)}>Dismiss</button>
          </div>
        )}

        {tab === "queue" && (
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
            <motion.div variants={item} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { label: "Immediate", value: stats.immediate || 0, sub: "See now", color: "text-red-400" },
                { label: "Urgent", value: stats.urgent || 0, sub: "Within 10 min", color: "text-orange-300" },
                { label: "Less Urgent", value: stats.less_urgent || 0, sub: "Within 60 min", color: "text-yellow-300" },
                { label: "Non-Urgent", value: stats.non_urgent || 0, sub: "Within 120 min", color: "text-emerald-300" },
                { label: "Total Queue", value: stats.total || 0, sub: "Active patients", color: mciMode ? "text-red-300" : "text-emerald-300" },
              ].map((s) => (
                <div key={s.label} className="glass-card p-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">{s.label}</div>
                  <div className={`mt-1 font-mono text-3xl font-semibold ${s.color}`}>{s.value}</div>
                  <div className="mt-1 text-xs text-zinc-500">{s.sub}</div>
                </div>
              ))}
            </motion.div>

            <motion.div variants={item} className="grid gap-4 xl:grid-cols-[360px_1fr_360px]">
              <PatientForm API={API} onPatientAdded={handlePatientAdded} />
              <PatientQueue queue={queue} selected={selected} onSelect={(patient) => setSelectedId(patient.id)} onDischarge={handleDischarge} />
              {selected ? (
                <DetailPanel patient={selected} onDischarge={handleDischarge} onOverride={handleOverride} onViewTrend={() => setTrendPatientId(selected.id)} API={API} />
              ) : (
                <div className="glass-card p-8 text-center text-sm text-zinc-500">Select a patient from the queue to view details.</div>
              )}
            </motion.div>
          </motion.div>
        )}

        {tab === "ambulance" && <AmbulancePreTriage API={API} />}
        {tab === "mass" && <MassCasualty API={API} onDone={fetchQueue} />}
        {tab === "beds" && <BedManagement beds={beds} API={API} />}
        {tab === "audit" && <AuditLog API={API} />}
        {tab === "handover" && <ShiftHandover API={API} queue={queue} />}
      </main>

      <AnimatePresence>
        {trendPatient && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setTrendPatientId(null)}>
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} className="glass-card relative max-h-[85vh] w-full max-w-2xl overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="btn absolute right-4 top-4 px-2 py-1" aria-label="Close vitals trend" onClick={() => setTrendPatientId(null)}>x</button>
              <div className="mb-4 text-lg font-semibold">Vitals Trend - {trendPatient.name}</div>
              <VitalsTrend patient={trendPatient} API={API} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
