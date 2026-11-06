// AlertsPanel.jsx
// Drop into Dashboard (or a dedicated Alerts page). Put in: src/components/AlertsPanel.jsx
import {
  FiTrendingDown, FiAlertTriangle, FiPackage, FiDroplet, FiBell, FiCheckCircle,
} from "react-icons/fi";
import "./AlertsPanel.css";
import { useLanguage } from "../i18n/LanguageContext";

const ICONS = {
  "trending-down": <FiTrendingDown />,
  "alert-triangle": <FiAlertTriangle />,
  "package": <FiPackage />,
  "droplet": <FiDroplet />,
};

export default function AlertsPanel({ alerts = [], title = "Alerts & Reminders" }) {
  const { t: tr } = useLanguage();
  return (
    <div className="alerts-panel">
      <div className="alerts-header">
        <FiBell />
        <h3>{tr(title)}</h3>
        {alerts.length > 0 && <span className="alerts-count">{alerts.length}</span>}
      </div>

      {alerts.length === 0 ? (
        <div className="alerts-empty">
          <FiCheckCircle />
          <p>{tr("All good — no alerts right now.")}</p>
        </div>
      ) : (
        <ul className="alerts-list">
          {alerts.map((a) => (
            <li key={a.id} className={`alert-item alert-${a.severity}`}>
              <div className="alert-icon">{ICONS[a.icon] || <FiBell />}</div>
              <div className="alert-body">
                <span className="alert-title">{tr(a.title)}</span>
                <span className="alert-message">{tr(a.message)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}