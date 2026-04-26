import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Truck, TriangleAlert as AlertTriangle, Bed, ClipboardList, FileText, Radio } from "lucide-react";
import PatientForm from "./components/PatientForm";
import PatientQueue from "./components/PatientQueue";
import DetailPanel from "./components/DetailPanel";
import BedManagement from "./components/BedManagement";
import AuditLog from "./components/AuditLog";
import MassCasualty from "./components/MassCasualty";
import AmbulancePreTriage from "./components/AmbulancePreTriage";
import ShiftHandover from "./components/ShiftHandover";
import VitalsTrend from "./components/VitalsTrend";

const API = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const socket = io(API || undefined, { path: "/socket.io", transports: ["websocket", "polling"] });

const TABS = [
  { id: "queue",    label: "Live Queue",  icon: Activity },
  { id: "ambulance",label: "Ambulance",   icon: Truck },
  { id: "mass",     label: "MCI Mode",    icon: AlertTriangle },
  { id: "beds",     label: "Beds",        icon: Bed },
  { id: "audit",    label: "Audit Log",   icon: ClipboardList },
  { id: "handover", label: "Handover",    icon: FileText },
];

const pageVariants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.12 } },
};

const statVariants = {
  hidden:  { opacity: 0, scale: 0.94 },
  visible: (i) => ({ opacity: 1, scale: 1, transition: { delay: i * 0.06, duration: 0.25, ease: "easeOut" } }),
};

export default function App() {
  const [tab, setTab] = useState("queue");
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({ total: 0, immediate: 0, urgent: 0, less_urgent: 0, non_urgent: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [trendPatientId, setTrendPatientId] = useState(null);
  const [ambulanceAlert, setAmbulanceAlert] = useState(null);
  const [beds, setBeds] = useState({});
  const selected = queue.find(p => p.id === selectedId) || null;
  const trendPatient = queue.find(p => p.id === trendPatientId) || null;

  useEffect(() => {
    socket.on("queue_update", ({ queue, stats }) => { setQueue(queue); setStats(stats); });
    socket.on("ambulance_incoming", (alert) => {
      setAmbulanceAlert(alert);
      toast(`Ambulance incoming: ${alert.patient_name} — ${alert.urgency_label}`, {
        duration: 8000,
        style: { background: "rgba(249,115,22,0.15)", color: "#fdba74", border: "1px solid rgba(249,115,22,0.3)", backdropFilter: "blur(12px)" },
      });
    });
    socket.on("patient_upgraded", ({ new_urgency }) => {
      const labels = ["IMMEDIATE", "URGENT", "LESS URGENT", "NON-URGENT"];
      toast.error(`Patient auto-upgraded to ${labels[new_urgency]} — deteriorating vitals`, { duration: 6000 });
    });
    socket.on("retriage_alerts", (alerts) => {
      alerts.forEach(a => toast(`Re-assess: ${a.name} waited ${a.waited_minutes}m (limit: ${a.limit}m)`, { duration: 5000 }));
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
      if (r.data.success) { setQueue(r.data.queue); setStats(r.data.stats); }
    } catch { toast.error("Unable to load patient queue"); }
  };

  const fetchBeds = async () => {
    try {
      const r = await axios.get(`${API}/api/beds`);
      if (r.data.success) setBeds(r.data.beds);
    } catch { toast.error("Unable to load bed status"); }
  };

  const handleDischarge = async (id) => {
    try {
      await axios.post(`${API}/api/discharge`, { patient_id: id });
      if (selectedId === id) setSelectedId(null);
      if (trendPatientId === id) setTrendPatientId(null);
      toast.success("Patient discharged");
    } catch { toast.error("Failed to discharge patient"); }
  };

  const handleOverride = async (id, level, reason) => {
    try {
      await axios.post(`${API}/api/override`, { patient_id: id, new_urgency_level: level, reason });
      toast.success("Triage decision overridden");
      fetchQueue();
    } catch { toast.error("Failed to override triage"); }
  };

  const handlePatientAdded = (patient) => {
    setQueue(prev => [...prev, patient].sort((a, b) => a.urgency_level - b.urgency_level));
    setSelectedId(patient.id);
    toast.success(`Patient triaged: ${patient.urgency_label}`, {
      style: { background: "rgba(34,197,94,0.12)", color: "#86efac", border: "1px solid rgba(34,197,94,0.28)" },
    });
  };

  useEffect(() => {
    if (selectedId && !queue.some(p => p.id === selectedId)) setSelectedId(null);
    if (trendPatientId && !queue.some(p => p.id === trendPatientId)) setTrendPatientId(null);
  }, [queue, selectedId, trendPatientId]);

  const STAT_CARDS = [
    { label: "Immediate",  value: stats.immediate  || 0, sub: "See now",        cls: "stat-red"    },
    { label: "Urgent",     value: stats.urgent     || 0, sub: "Within 10 min",  cls: "stat-orange"  },
    { label: "Less Urgent",value: stats.less_urgent|| 0, sub: "Within 60 min",  cls: "stat-yellow"  },
    { label: "Non-Urgent", value: stats.non_urgent || 0, sub: "Within 120 min", cls: "stat-green"   },
    { label: "Total Queue",value: stats.total      || 0, sub: "Active patients", cls: "stat-blue"   },
  ];

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #0B1120 0%, #0d1526 60%, #091018 100%)" }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "rgba(17,29,53,0.95)", color: "#f1f5f9",
            border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)",
            fontFamily: "Inter, sans-serif", fontSize: "13px",
          },
        }}
      />

      {/* Header */}
      <header
        className="sticky top-0 z-50 flex items-center gap-4 px-6"
        style={{
          height: 60,
          background: "rgba(11,17,32,0.88)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0 mr-2">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 36, height: 36,
              background: "linear-gradient(135deg, rgba(239,68,68,0.85), rgba(239,68,68,0.4))",
              border: "1px solid rgba(239,68,68,0.4)",
              boxShadow: "0 0 18px rgba(239,68,68,0.3)",
            }}
          >
            <Activity size={18} color="#fff" />
          </div>
          <div>
            <div className="font-bold text-sm" style={{ color: "#f1f5f9", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              AI TRIAGE
            </div>
            <div className="font-mono text-[9px]" style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>
              EMERGENCY COMMAND CENTER
            </div>
          </div>
        </div>

        {/* Tabs */}
        <nav className="tab-bar">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`tab-btn flex items-center gap-1.5 ${tab === t.id ? "active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                <Icon size={12} />
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Live badge */}
        <div className="flex items-center gap-3 ml-auto shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)" }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 live-dot" />
            <span className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color: "#4ade80" }}>LIVE</span>
          </div>
          <div className="font-mono text-[11px] flex items-center gap-1" style={{ color: "rgba(255,255,255,0.38)" }}>
            <span className="stat-red font-bold">{stats.immediate || 0}</span>
            <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
            <span className="stat-orange font-bold">{stats.urgent || 0}</span>
            <span className="ml-1">critical</span>
          </div>
        </div>
      </header>

      {/* Ambulance alert bar */}
      <AnimatePresence>
        {ambulanceAlert && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ background: "rgba(249,115,22,0.08)", borderBottom: "1px solid rgba(249,115,22,0.22)" }}
          >
            <div className="flex items-center gap-3 px-6 py-2.5">
              <Truck size={14} color="#fb923c" />
              <span className="font-semibold text-sm" style={{ color: "#fb923c" }}>INCOMING</span>
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                {ambulanceAlert.patient_name} · Age {ambulanceAlert.age} · {ambulanceAlert.urgency_label} · ETA {ambulanceAlert.eta_minutes} min
              </span>
              <button className="btn ml-auto" style={{ padding: "3px 10px", fontSize: 11 }} onClick={() => setAmbulanceAlert(null)}>
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="px-5 py-5 max-w-screen-2xl mx-auto">
        <AnimatePresence mode="wait">
          {tab === "queue" && (
            <motion.div key="queue" variants={pageVariants} initial="hidden" animate="visible" exit="exit">
              {/* Stats */}
              <div className="grid grid-cols-5 gap-3 mb-5">
                {STAT_CARDS.map((s, i) => (
                  <motion.div key={s.label} custom={i} variants={statVariants} initial="hidden" animate="visible" className="glass-card p-4">
                    <div className="field-label mb-2">{s.label}</div>
                    <div className={`text-3xl font-bold font-mono leading-none mb-1 ${s.cls}`}>{s.value}</div>
                    <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.32)" }}>{s.sub}</div>
                  </motion.div>
                ))}
              </div>

              {/* 3-column grid */}
              <div className="grid gap-4" style={{ gridTemplateColumns: "380px 1fr 310px" }}>
                <PatientForm API={API} onPatientAdded={handlePatientAdded} />
                <PatientQueue queue={queue} selected={selected} onSelect={p => setSelectedId(p.id)} onDischarge={handleDischarge} />
                <div>
                  {selected ? (
                    <DetailPanel patient={selected} onDischarge={handleDischarge} onOverride={handleOverride} onViewTrend={() => setTrendPatientId(selected.id)} API={API} />
                  ) : (
                    <div className="glass-card flex flex-col items-center justify-center" style={{ minHeight: 300, padding: 32 }}>
                      <div className="rounded-full mb-3 flex items-center justify-center"
                        style={{ width: 44, height: 44, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <Radio size={18} style={{ color: "rgba(255,255,255,0.18)" }} />
                      </div>
                      <div className="text-sm font-semibold mb-1" style={{ color: "rgba(255,255,255,0.28)" }}>No Patient Selected</div>
                      <div className="text-xs text-center" style={{ color: "rgba(255,255,255,0.18)" }}>Select a patient from the queue</div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {tab === "ambulance" && (
            <motion.div key="ambulance" variants={pageVariants} initial="hidden" animate="visible" exit="exit">
              <AmbulancePreTriage API={API} />
            </motion.div>
          )}
          {tab === "mass" && (
            <motion.div key="mass" variants={pageVariants} initial="hidden" animate="visible" exit="exit">
              <MassCasualty API={API} onDone={fetchQueue} />
            </motion.div>
          )}
          {tab === "beds" && (
            <motion.div key="beds" variants={pageVariants} initial="hidden" animate="visible" exit="exit">
              <BedManagement beds={beds} API={API} />
            </motion.div>
          )}
          {tab === "audit" && (
            <motion.div key="audit" variants={pageVariants} initial="hidden" animate="visible" exit="exit">
              <AuditLog API={API} />
            </motion.div>
          )}
          {tab === "handover" && (
            <motion.div key="handover" variants={pageVariants} initial="hidden" animate="visible" exit="exit">
              <ShiftHandover API={API} queue={queue} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Vitals trend modal */}
      <AnimatePresence>
        {trendPatient && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
            onClick={() => setTrendPatientId(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="glass-card-light relative"
              style={{ width: 580, maxHeight: "85vh", overflowY: "auto", padding: 28 }}
              onClick={e => e.stopPropagation()}
            >
              <button className="absolute top-4 right-4 btn" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setTrendPatientId(null)}>
                Close
              </button>
              <div className="font-bold text-base mb-4 tracking-wide">
                Vitals Trend —{" "}
                <span style={{ color: "rgba(255,255,255,0.55)" }}>{trendPatient.name}</span>
              </div>
              <VitalsTrend patient={trendPatient} API={API} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
