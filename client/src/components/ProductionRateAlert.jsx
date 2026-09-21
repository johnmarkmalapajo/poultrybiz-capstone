import { useEffect, useState } from "react";
import { FiCheckCircle, FiAlertTriangle, FiAlertCircle, FiHelpCircle } from "react-icons/fi";
import "./ProductionRateAlert.css";

function getAlertState(rate) {
  if (rate >= 100)
    return {
      label: "Normal", tone: "green", Icon: FiCheckCircle,
      message: "All chickens have produced eggs. Production is normal.",
    };
  if (rate >= 75)
    return {
      label: "Warning", tone: "yellow", Icon: FiAlertTriangle,
      message: "Egg production is below normal.",
    };
  if (rate >= 50)
    return {
      label: "Critical", tone: "red", Icon: FiAlertCircle,
      message: "Egg production has dropped significantly. Immediate inspection is recommended.",
    };
  if (rate > 0)
    return {
      label: "Critical", tone: "red", Icon: FiAlertCircle,
      message: "Egg production has dropped significantly. Immediate inspection is recommended.",
    };
  return {
    label: "Critical", tone: "darkred", Icon: FiAlertCircle,
    message: "No egg production detected. Immediate action is required.",
  };
}

export default function ProductionRateAlert({
  eggsProduced = 0,
  currentQty,
  productionRate,
  lastUpdated,
}) {
  const hasValidQty = Number(currentQty) > 0;

  const rate =
    typeof productionRate === "number"
      ? productionRate
      : hasValidQty
        ? Math.round((Number(eggsProduced) / Number(currentQty)) * 100)
        : null;

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

  if (rate == null) {
    return (
      <div className="pra-card pra-gray">
        <div className="pra-head">
          <div className="pra-title">
            <span className="pra-dot" />
            <h3>Production Rate Alert</h3>
          </div>
          <span className="pra-badge pra-badge-gray">
            <FiHelpCircle /> No Data
          </span>
        </div>
        <div className="pra-message">
          <FiHelpCircle className="pra-message-icon" />
          <p>No valid bird count is available for this batch, so a production rate cannot be calculated.</p>
        </div>
        <div className="pra-updated">Last updated: {timeText}</div>
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(100, isFinite(rate) ? rate : 0));
  const state = getAlertState(clamped);
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
              : `${Number(eggsProduced) || 0} of ${currentQty} produced`}
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