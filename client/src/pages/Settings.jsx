import { useSearchParams, useLocation } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import "./Settings.css";
import Profile from "./Profile";
import UsersRoles from "./UsersRoles";
import AuditLogs from "./AuditLogs";
import Archive from "./Archive";
import { useUser } from "../hooks/useUser";

const ALL_CARDS = [
  {
    id: "profile",
    label: "My Profile",
    emoji: "👤",
    description: "Update your name, contact, and profile photo",
    color: "#e8a020",
    bg: "#fff8ec",
    ownerOnly: false,
  },
  {
    id: "users-roles",
    label: "Users & Roles",
    emoji: "👥",
    description: "Manage accounts, approvals, and access permissions",
    color: "#a855f7",
    bg: "#f3e8ff",
    ownerOnly: true,
  },
  {
    id: "audit-logs",
    label: "Audit Logs",
    emoji: "📋",
    description: "Monitor activity history and system changes",
    color: "#5aab6e",
    bg: "#edf7f0",
    ownerOnly: true,
  },
  {
    id: "archive",
    label: "Archive",
    emoji: "🗂️",
    description: "View and restore archived records",
    color: "#4a90d9",
    bg: "#eef4fc",
    ownerOnly: true,
  },
];

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const { isManagement, isOwner } = useUser();

  const cards = ALL_CARDS.filter(
    (card) => (card.id === "audit-logs" ? isOwner : !card.ownerOnly || isManagement)
  );

  const VALID = cards.map((c) => c.id);

  const raw = searchParams.get("view");
  const viewMode = VALID.includes(raw) ? raw : "menu";
  const activeCard = cards.find((c) => c.id === viewMode);

  const openCard = (id) => setSearchParams({ view: id });
  const backToMenu = () => setSearchParams({});

  const fromSidebar =
    viewMode === "profile" &&
    Boolean(location.state?.fromSidebar);

  const breadcrumbItems =
    viewMode === "menu"
      ? [{ label: "SETTINGS" }]
      : fromSidebar
      ? [{ label: "PROFILE" }]
      : [
          { label: "SETTINGS", path: "/settings" },
          { label: (activeCard?.label || "").toUpperCase() },
        ];

  return (
    <PageLayout breadcrumbItems={breadcrumbItems}>
      {viewMode === "menu" ? (
        <div className="st-grid">
          {cards.map((card, i) => (
            <button
              key={card.id}
              className="st-card"
              style={{
                "--card-color": card.color,
                "--card-bg": card.bg,
                animationDelay: `${i * 80}ms`,
              }}
              onClick={() => openCard(card.id)}
            >
              <div className="st-card-icon-wrap">
                <span className="st-card-emoji">{card.emoji}</span>
              </div>

              <div className="st-card-body">
                <span className="st-card-label">{card.label}</span>
                <span className="st-card-desc">{card.description}</span>
              </div>

              <span className="st-card-arrow">›</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          {viewMode === "profile" && (
            <Profile embedded onBack={backToMenu} />
          )}

          {viewMode === "users-roles" && isManagement && (
            <UsersRoles embedded onBack={backToMenu} />
          )}

          {viewMode === "audit-logs" && isOwner && (
            <AuditLogs embedded onBack={backToMenu} />
          )}

          {viewMode === "archive" && isManagement && (
            <Archive embedded onBack={backToMenu} />
          )}
        </>
      )}
    </PageLayout>
  );
}