import { useNavigate } from "react-router-dom";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./Inventory.css";

const cards = [
  { id: "feed-inventory",   label: "Feed Inventory",          emoji: "🌾", description: "Track feed stock levels and supplies",  color: "#e8a020", bg: "#fff8ec", path: "/inventory/feed-inventory" },
  { id: "feed-consumption", label: "Feed Consumption",        emoji: "🐔", description: "Monitor daily feed usage per flock",    color: "#5aab6e", bg: "#edf7f0", path: "/inventory/feed-consumption" },
  { id: "equipment",        label: "Equipment & Tool Record", emoji: "🔧", description: "Manage tools and farm equipment",       color: "#4a90d9", bg: "#eef4fc", path: "/inventory/equipment" },
];

export default function Inventory() {
  const navigate = useNavigate();

  return (
    <div className="inv-page">
      <Sidebar />
      <div className="inv-main">
        {/* Page header only — no breadcrumb, no search */}
        <div className="inv-topbar">
          <button className="inv-hamburger" onClick={openSidebar} aria-label="Open menu">☰</button>
          <h2 className="inv-title">INVENTORY</h2>
        </div>

        <div className="inv-grid">
          {cards.map((card, i) => (
            <button
              key={card.id}
              className="inv-card"
              style={{ "--card-color": card.color, "--card-bg": card.bg, animationDelay: `${i * 80}ms` }}
              onClick={() => navigate(card.path)}
            >
              <div className="inv-card-icon-wrap">
                <span className="inv-card-emoji">{card.emoji}</span>
              </div>
              <div className="inv-card-body">
                <span className="inv-card-label">{card.label}</span>
                <span className="inv-card-desc">{card.description}</span>
              </div>
              <span className="inv-card-arrow">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
