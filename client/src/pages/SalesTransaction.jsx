import { useNavigate } from "react-router-dom";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./SalesTransaction.css";

const cards = [
  { id: "sales",    label: "Sales Record",    emoji: "💰", description: "Record egg sales and track revenue",        color: "#e8a020", bg: "#fff8ec", path: "/sales-transactions/sales" },
  { id: "expenses", label: "Expenses Record", emoji: "🧾", description: "Log farm expenses and operating costs",     color: "#e05555", bg: "#fdf0f0", path: "/sales-transactions/expenses" },
];

export default function SalesTransaction() {
  const navigate = useNavigate();

  return (
    <div className="st-page">
      <Sidebar />
      <div className="st-main">
        {/* Page header only — no breadcrumb, no search */}
        <div className="st-topbar">
          <button className="st-hamburger" onClick={openSidebar} aria-label="Open menu">☰</button>
          <h2 className="st-title">SALES &amp; TRANSACTIONS</h2>
        </div>

        <div className="st-grid">
          {cards.map((card, i) => (
            <button
              key={card.id}
              className="st-card"
              style={{ "--card-color": card.color, "--card-bg": card.bg, animationDelay: `${i * 80}ms` }}
              onClick={() => navigate(card.path)}
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
      </div>
    </div>
  );
}
