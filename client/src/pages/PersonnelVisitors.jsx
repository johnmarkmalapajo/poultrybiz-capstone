import { useNavigate } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import "./PersonnelVisitors.css";

const cards = [
  {
    id: "personnel",
    label: "Personnel and Manpower",
    emoji: "👷",
    description: "Manage farm staff, roles, and manpower records",
    color: "#e8a020",
    bg: "#fff8ec",
    path: "/personnel-visitors/personnel",
  },
  {
    id: "visitors",
    label: "Visitor's Log",
    emoji: "🪪",
    description: "Record and monitor farm visitor entries",
    color: "#4a90d9",
    bg: "#eef4fc",
    path: "/personnel-visitors/visitors",
  },
];

export default function PersonnelVisitors() {
  const navigate = useNavigate();

  return (
    <PageLayout breadcrumbItems={[{ label: "PERSONNEL AND VISITORS" }]}>
      <div className="pv-grid">
        {cards.map((card, i) => (
          <button
            key={card.id}
            className="pv-card"
            style={{ "--card-color": card.color, "--card-bg": card.bg, animationDelay: `${i * 80}ms` }}
            onClick={() => navigate(card.path)}
          >
            <div className="pv-card-icon-wrap">
              <span className="pv-card-emoji">{card.emoji}</span>
            </div>
            <div className="pv-card-body">
              <span className="pv-card-label">{card.label}</span>
              <span className="pv-card-desc">{card.description}</span>
            </div>
            <span className="pv-card-arrow">›</span>
          </button>
        ))}
      </div>
    </PageLayout>
  );
}