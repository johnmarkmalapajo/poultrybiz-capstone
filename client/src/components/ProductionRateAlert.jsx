import { useEffect, useState } from "react";
import { FiCheckCircle, FiAlertTriangle, FiAlertCircle } from "react-icons/fi";
import "./ProductionRateAlert.css";

const DEFAULT_QTY = 4; // each cage contains 4 chickens

// Map a production rate (%) to its status, color, message, and icon.
function getAlertState(rate) {
  if (rate >= 100)
    return {
      label: "Normal", tone: "green", Icon: FiCheckCircle,
      message: "All chickens have produced eggs. Production is normal.",
    };
  if (rate >= 75)
    return {
      label: "Warning", tone: "yellow", Icon: FiAlertTriangle,
      message: "Production is slightly below normal. Continue monitoring.",
    };
  if (rate >= 50)
    return {
      label: "Critical", tone: "red", Icon: FiAlertCircle,
      message: "Production has dropped significantly. Immediate inspection is recommended.",
    };
  if (rate > 0)
    return {
      label: "Critical", tone: "red", Icon: FiAlertCircle,
      message: "Very low production detected. Check the chickens immediately.",
    };
  return {
    label: "Critical", tone: "darkred", Icon: FiAlertCircle,
    message: "No egg production detected. Immediate action is required.",
  };
}

/**
 * Real-time Chicken Production Rate Alert.
 *
 * Pass either:
 *   - eggsProduced + currentQty (rate is computed: (eggs / qty) * 100), or
 *   - productionRate directly (already a %)
 *
 * Re-renders/updates automatically whenever the props change.
 */
export default function ProductionRateAlert({
  eggsProduced = 0,
  currentQty = DEFAULT_QTY,
  productionRate,
  lastUpdated,
}) {
  const qty = Number(currentQty) > 0 ? Number(currentQty) : DEFAULT_QTY;

  const rate =
    typeof productionRate === "number"
      ? productionRate
      : Math.round((Number(eggsProduced) / qty) * 100);

  const clamped = Math.max(0, Math.min(100, isFinite(rate) ? rate : 0));
  const state = getAlertState(clamped);

  // "Last Updated" refreshes whenever the underlying production data changes
  const [updatedAt, setUpdatedAt] = useState(
    lastUpdated ? new Date(lastUpdated) : new Date()
  );
  useEffect(() => {
    setUpdatedAt(lastUpdated ? new Date(lastUpdated) : new Date());
  }, [eggsProduced, currentQty, productionRate, lastUpdated]);

  const timeText = updatedAt.toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });

  const { Icon } = state;

  return (
    <div className={`pra-card pra-${state.tone}`}>
      <div className="pra-head">
        <div className="pra-title">
          <span className="pra-dot" />
          <h3>Production Rate Alert</h3>
        </div>
        <span className={`pra-badge pra-badge-${state.tone}`}>
          <Icon /> {state.label}
        </span>
      </div>

      <div className="pra-rate-row">
        <div className="pra-rate-value">{clamped}<span>%</span></div>
        <div className="pra-rate-meta">
          <span className="pra-rate-label">Production Rate</span>
          <span className="pra-rate-sub">
            {typeof productionRate === "number"
              ? "Current production"
              : `${Number(eggsProduced) || 0} of ${qty} produced`}
          </span>
        </div>
      </div>

      <div className="pra-bar">
        <div className="pra-bar-fill" style={{ width: `${clamped}%` }} />
      </div>

      <div className="pra-message">
        <Icon className="pra-message-icon" />
        <p>{state.message}</p>
      </div>

      <div className="pra-updated">Last updated: {timeText}</div>
    </div>
  );
}
