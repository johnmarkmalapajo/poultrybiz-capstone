import { useLanguage } from "../i18n/LanguageContext";
import { useNavigate } from "react-router-dom";
import "./PendingApproval.css";

export default function PendingApproval() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const user = JSON.parse(localStorage.getItem("pendingUser") || "{}");

  return (
    <div className="pa-bg">
      <div className="pa-card">

        <div className="pa-icon">⏳</div>

        <h2 className="pa-title">{t("Waiting for Approval")}</h2>

        <p className="pa-desc">
          {t("Hi")} <strong>{user.name || t("there")}</strong>! {t("Your account has been created successfully.")}
        </p>

        <p className="pa-desc">
          {t("Please wait for the")} <strong>{t("Owner")}</strong>{" "}
          {t("to approve your account before you can access the system. You will be able to login once your account is approved.")}
        </p>

        <div className="pa-info-box">
          <div className="pa-info-row">
            <span className="pa-info-label">{t("Name")}</span>
            <span className="pa-info-value">{user.name || "—"}</span>
          </div>
          <div className="pa-info-row">
            <span className="pa-info-label">{t("Email")}</span>
            <span className="pa-info-value">{user.email || "—"}</span>
          </div>
          <div className="pa-info-row">
            <span className="pa-info-label">{t("Role")}</span>
            <span className="pa-info-value">{user.role ? t(user.role) : "—"}</span>
          </div>
          <div className="pa-info-row">
            <span className="pa-info-label">{t("Status")}</span>
            <span className="pa-status-badge">{t("Pending Approval")}</span>
          </div>
        </div>
        <button
            className="pa-btn"
            onClick={() => {
                localStorage.removeItem("pendingUser");
                navigate("/login");
            }}
        >
            {t("Back to Login")}
        </button>

      </div>
    </div>
  );
}