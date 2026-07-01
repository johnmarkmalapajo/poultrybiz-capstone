import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "./SalesTransaction.css";

const cards = [
  {
    id: "sales",
    label: "Sales Record",
    emoji: "💰",
    description: "Track all sales and revenue transactions",
    color: "#5aab6e",
    bg: "#edf7f0",
    path: "/sales-transactions/sales",
  },
  {
    id: "expenses",
    label: "Expenses Record",
    emoji: "🧾",
    description: "Monitor and log all farm expenses",
    color: "#e05555",
    bg: "#fdf0f0",
    path: "/sales-transactions/expenses",
  },
];

export default function SalesTransactions() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filtered = cards.filter((c) =>
    c.label.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="st-page">
      <Sidebar />
      <div className="st-main">
        <Topbar
          searchValue={search}
          onSearchChange={(e) => setSearch(e.target.value)}
          searchPlaceholder="Search..."
        />

        <h2 className="st-title">SALES AND TRANSACTIONS</h2>

        <div className="st-grid">
          {filtered.map((card, i) => (
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