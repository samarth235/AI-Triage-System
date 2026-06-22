import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, AlertTriangle, BedDouble, ClipboardList, Menu, ShieldPlus, Siren, Stethoscope, Truck, X } from "lucide-react";
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

const PAGE_DESCRIPTIONS = {
  queue: "Real-time overview of patients awaiting triage and treatment.",
  ambulance: "Send pre-arrival clinical information to the emergency team.",
  mass: "Coordinate rapid triage during a mass-casualty incident.",
  beds: "Monitor occupancy and availability across hospital wards.",
  audit: "Review triage decisions, overrides, and safety events.",
  handover: "Prepare a complete clinical handover for the incoming shift.",
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

export default function App() {
  const [tab, setTab] = useState("queue");
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({ total: 0, immediate: 0, urgent: 0, less_urgent: 0, non_urgent: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [trendPatientId, setTrendPatientId] = useState(null);
  const [ambulanceAlert, setAmbulanceAlert] = useState(null);
  const [beds, setBeds] = useState({});
  const [mciMode, setMciMode] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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
      alerts.forEach((alert) => toast(`Re-assess: ${alert.name} has waited ${alert.waited_minutes}m (limit: ${alert.limit}m)`, { duration: 5000 }));
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
      const response = await axios.get(`${API}/api/queue`);
      if (response.data.success) {
        setQueue(response.data.queue);
        setStats(response.data.stats);
      }
    } catch {
      toast.error("Unable to load patient queue");
    }
  };

  const fetchBeds = async () => {
    try {
      const response = await axios.get(`${API}/api/beds`);
      if (response.data.success) setBeds(response.data.beds);
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
    setQueue((previous) => [...previous, patient].sort((a, b) => a.urgency_level - b.urgency_level));
    setSelectedId(patient.id);
    toast.success(`Patient triaged: ${patient.urgency_label}`);
  };

  useEffect(() => {
    if (selectedId && !queue.some((patient) => patient.id === selectedId)) setSelectedId(null);
    if (trendPatientId && !queue.some((patient) => patient.id === trendPatientId)) setTrendPatientId(null);
  }, [queue, selectedId, trendPatientId]);

  const accent = mciMode ? "#dc2626" : "#2563eb";
  const activeTab = TABS.find((entry) => entry.id === tab);

  return (
    <div className={`app-shell ${mciMode ? "mci" : ""}`} style={{ "--accent": accent }}>
      <Toaster position="top-right" toastOptions={{ style: { background: "#ffffff", color: "#172033", border: "1px solid #dce2ea", boxShadow: "0 12px 30px rgba(15, 23, 42, .12)" } }} />

      <button className="mobile-nav-trigger" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
        <Menu size={20} />
      </button>
      {mobileNavOpen && <button className="nav-scrim" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}

      <aside className={`app-sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <div className="brand-block">
          <div className="brand-mark"><ShieldPlus size={22} strokeWidth={1.8} /></div>
          <div>
            <div className="brand-title">Crisis Response</div>
            <div className="brand-title">Command Center</div>
          </div>
          <button className="sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <div className="brand-subtitle">Hospital incident operations</div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {TABS.map((entry) => {
            const Icon = entry.icon;
            const active = tab === entry.id;
            return (
              <button
                key={entry.id}
                onClick={() => { setTab(entry.id); setMobileNavOpen(false); }}
                className={`sidebar-nav-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon strokeWidth={1.7} size={19} />
                <span>{entry.label}</span>
              </button>
            );
          })}
        </nav>

        <button onClick={() => setMciMode((current) => !current)} className={`mci-control ${mciMode ? "active" : ""}`}>
          <AlertTriangle strokeWidth={1.7} size={18} />
          <span>{mciMode ? "MCI Mode Active" : "Enable MCI Mode"}</span>
        </button>

        <div className="sidebar-footer">
          <div className="user-avatar">ER</div>
          <div>
            <div className="user-name">Emergency Team</div>
            <div className="user-role">Current shift</div>
          </div>
        </div>
      </aside>

      <section className="app-content">
        <header className="page-header">
          <div>
            <div className="page-eyebrow">Emergency operations</div>
            <h1>{activeTab?.label || "Dashboard"}</h1>
            <p>{PAGE_DESCRIPTIONS[tab]}</p>
          </div>
          <div className="shift-status">
            <span className="status-dot" />
            <div>
              <strong>Current shift</strong>
              <span>Day shift · Live</span>
            </div>
          </div>
        </header>

        <main className="page-main">
          {ambulanceAlert && (
            <div className="incoming-alert">
              <Truck strokeWidth={1.5} size={18} />
              <strong>Incoming:</strong> {ambulanceAlert.patient_name} · Age {ambulanceAlert.age} · {ambulanceAlert.urgency_label} · ETA {ambulanceAlert.eta_minutes} min
              <button className="btn ml-auto" onClick={() => setAmbulanceAlert(null)}>Dismiss</button>
            </div>
          )}

          {tab === "queue" && (
            <motion.div variants={container} initial="hidden" animate="show" className="queue-page">
              <motion.div variants={item} className="urgency-strip">
                {[
                  { label: "Immediate", value: stats.immediate || 0, sub: "See now", key: "immediate" },
                  { label: "Urgent", value: stats.urgent || 0, sub: "Within 10 min", key: "urgent" },
                  { label: "Less Urgent", value: stats.less_urgent || 0, sub: "Within 60 min", key: "less-urgent" },
                  { label: "Non-Urgent", value: stats.non_urgent || 0, sub: "Within 120 min", key: "non-urgent" },
                  { label: "Total Queue", value: stats.total || 0, sub: "Active patients", key: "total" },
                ].map((stat) => (
                  <div key={stat.label} className={`urgency-stat urgency-${stat.key}`}>
                    <div className="urgency-label">{stat.label}</div>
                    <div className="urgency-value">{stat.value}</div>
                    <div className="urgency-sub">{stat.sub}</div>
                  </div>
                ))}
              </motion.div>

              <motion.div variants={item} className="queue-workspace">
                <PatientForm API={API} onPatientAdded={handlePatientAdded} />
                <PatientQueue queue={queue} selected={selected} onSelect={(patient) => setSelectedId(patient.id)} />
                {selected ? (
                  <DetailPanel patient={selected} onDischarge={handleDischarge} onOverride={handleOverride} onViewTrend={() => setTrendPatientId(selected.id)} API={API} />
                ) : (
                  <div className="empty-detail">
                    <ShieldPlus size={28} strokeWidth={1.4} />
                    <strong>No patient selected</strong>
                    <span>Select a patient from the queue to review clinical details.</span>
                  </div>
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
      </section>

      <AnimatePresence>
        {trendPatient && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-backdrop" onClick={() => setTrendPatientId(null)}>
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} className="modal-panel" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="modal-close" aria-label="Close vitals trend" onClick={() => setTrendPatientId(null)}><X size={18} /></button>
              <div className="mb-4 text-lg font-semibold">Vitals Trend - {trendPatient.name}</div>
              <VitalsTrend patient={trendPatient} API={API} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
