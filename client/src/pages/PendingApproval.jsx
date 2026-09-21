import { useNavigate } from "react-router-dom";
import "./PendingApproval.css";

export default function PendingApproval() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("pendingUser") || "{}");

  return (
    <div className="pa-bg">
      <div className="pa-card">

        <div className="pa-icon">⏳</div>

        <h2 className="pa-title">Waiting for Approval</h2>

        <p className="pa-desc">
          Hi <strong>{user.name || "there"}</strong>! Your account has been created successfully.
        </p>

        <p className="pa-desc">
          Please wait for the <strong>Owner</strong> to approve your account before you can access the system.
          You will be able to login once your account is approved.
        </p>

        <div className="pa-info-box">
          <div className="pa-info-row">
            <span className="pa-info-label">Name</span>
            <span className="pa-info-value">{user.name || "—"}</span>
          </div>
          <div className="pa-info-row">
            <span className="pa-info-label">Email</span>
            <span className="pa-info-value">{user.email || "—"}</span>
          </div>
          <div className="pa-info-row">
            <span className="pa-info-label">Role</span>
            <span className="pa-info-value">{user.role || "—"}</span>
          </div>
          <div className="pa-info-row">
            <span className="pa-info-label">Status</span>
            <span className="pa-status-badge">Pending Approval</span>
          </div>
        </div>
        <button
            className="pa-btn"
            onClick={() => {
                localStorage.removeItem("pendingUser");
                navigate("/login");
            }}
        >
            Back to Login
        </button>

      </div>
    </div>
  );
}