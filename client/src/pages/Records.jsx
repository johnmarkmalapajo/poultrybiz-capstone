import { useNavigate } from "react-router-dom";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./Records.css";

const cards = [
  { id: "flock",      label: "Flock Profile",          emoji: "🐔", description: "Manage your flock batches and bird info",        color: "#e8a020", bg: "#fff8ec", path: "/records/flock" },
  { id: "egg",        label: "Egg Record",             emoji: "🥚", description: "Log daily egg harvests and size distribution",   color: "#5aab6e", bg: "#edf7f0", path: "/records/egg" },
  { id: "health",     label: "Health Record",          emoji: "🏥", description: "Track treatments, vaccines, and vet visits",     color: "#e05555", bg: "#fdf0f0", path: "/records/health" },
  { id: "mortality",  label: "Mortality Record",       emoji: "📋", description: "Record and monitor bird mortality data",         color: "#4a90d9", bg: "#eef4fc", path: "/records/mortality" },
  { id: "quarantine", label: "Quarantine & Isolation", emoji: "🔒", description: "Monitor isolated and quarantined birds",         color: "#9c27b0", bg: "#f3e5f5", path: "/records/quarantine" },
  { id: "manure",     label: "Manure & Waste Record",  emoji: "♻️", description: "Track manure collection and waste management",   color: "#795548", bg: "#efebe9", path: "/records/manure" },
];

export default function Records() {
  const navigate = useNavigate();

  return (
    <div className="records-page">
      <Sidebar />
      <div className="records-main">
        {/* Page header only — no breadcrumb, no search */}
        <div className="records-topbar-left">
          <button className="records-hamburger" onClick={openSidebar} aria-label="Open menu">☰</button>
          <h2 className="records-title">RECORDS</h2>
        </div>

        <div className="records-grid">
          {cards.map((card, i) => (
            <button
              key={card.id}
              className="record-card"
              style={{ "--card-color": card.color, "--card-bg": card.bg, animationDelay: `${i * 80}ms` }}
              onClick={() => navigate(card.path)}
            >
              <div className="card-icon-wrap">
                <span className="card-emoji">{card.emoji}</span>
              </div>
              <div className="card-body">
                <span className="card-label">{card.label}</span>
                <span className="card-desc">{card.description}</span>
              </div>
              <span className="card-arrow">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
