import { useSearchParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "./Records.css";                 // reuse the EXACT Records styling
import "./Settings.css";                // embedded sub-module responsive tweaks
import Profile from "./Profile";         // role-based (Admin/Farmer)
import UsersRoles from "./UsersRoles";
import AuditLogs from "./AuditLogs";
import Archive from "./Archive";

const cards = [
  {
    id: "profile",
    label: "My Profile",
    emoji: "👤",
    description: "Update your name, contact, and profile photo",
    color: "#e8a020",
    bg: "#fff8ec",
  },
  {
    id: "users-roles",
    label: "Users & Roles",
    emoji: "👥",
    description: "Manage accounts, approvals, and access permissions",
    color: "#a855f7",
    bg: "#f3e8ff",
  },
  {
    id: "audit-logs",
    label: "Audit Logs",
    emoji: "📋",
    description: "Monitor activity history and system changes",
    color: "#5aab6e",
    bg: "#edf7f0",
  },
  {
    id: "archive",
    label: "Archive",
    emoji: "🗂️",
    description: "View and restore archived records",
    color: "#4a90d9",
    bg: "#eef4fc",
  },
];

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();

  // View is driven by the URL (?view=archive). Clicking "Settings" in the
  // sidebar navigates to /settings (no query) → always back to the cards,
  // no matter which sub-page you're on.
  const VALID = ["profile", "users-roles", "audit-logs", "archive"];
  const raw = searchParams.get("view");
  const viewMode = VALID.includes(raw) ? raw : "menu";

  const openCard = (id) => setSearchParams({ view: id });
  const backToMenu = () => setSearchParams({});


  return (
    <div className="records-page">
      <Sidebar />
      <div className="records-main">
        {viewMode === "menu" ? (
          <>
            <h2 className="records-title">SETTINGS</h2>

            <div className="records-grid">
              {cards.map((card, i) => (
                <button
                  key={card.id}
                  className="record-card"
                  style={{ "--card-color": card.color, "--card-bg": card.bg, animationDelay: `${i * 80}ms` }}
                  onClick={() => openCard(card.id)}
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
          </>
        ) : (
          <>
            {viewMode === "profile"     && <Profile    embedded onBack={backToMenu} />}
            {viewMode === "users-roles" && <UsersRoles embedded onBack={backToMenu} />}
            {viewMode === "audit-logs"  && <AuditLogs  embedded onBack={backToMenu} />}
            {viewMode === "archive"     && <Archive    embedded onBack={backToMenu} />}
          </>
        )}
      </div>
    </div>
  );
}
