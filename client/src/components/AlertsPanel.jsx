// AlertsPanel.jsx
// Drop into Dashboard (or a dedicated Alerts page). Put in: src/components/AlertsPanel.jsx
import {
  FiTrendingDown, FiAlertTriangle, FiPackage, FiDroplet, FiBell, FiCheckCircle,
} from "react-icons/fi";
import "./AlertsPanel.css";

const ICONS = {
  "trending-down": <FiTrendingDown />,
  "alert-triangle": <FiAlertTriangle />,
  "package": <FiPackage />,
  "droplet": <FiDroplet />,
};

export default function AlertsPanel({ alerts = [], title = "Alerts & Reminders" }) {
  return (
    <div className="alerts-panel">
      <div className="alerts-header">
        <FiBell />
        <h3>{title}</h3>
        {alerts.length > 0 && <span className="alerts-count">{alerts.length}</span>}
      </div>

      {alerts.length === 0 ? (
        <div className="alerts-empty">
          <FiCheckCircle />
          <p>All good — no alerts right now.</p>
        </div>
      ) : (
        <ul className="alerts-list">
          {alerts.map((a) => (
            <li key={a.id} className={`alert-item alert-${a.severity}`}>
              <div className="alert-icon">{ICONS[a.icon] || <FiBell />}</div>
              <div className="alert-body">
                <span className="alert-title">{a.title}</span>
                <span className="alert-message">{a.message}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
