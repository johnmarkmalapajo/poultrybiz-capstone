import { useLanguage } from "../i18n/LanguageContext";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import "./ResetPassword.css";

const BASE_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/v1`;

export default function ResetPassword() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [form, setForm]           = useState({ password: "", confirmPassword: "" });
  const [showPass, setShowPass]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState(false);
  const [loading, setLoading]     = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) { setError(t("Password must be at least 6 characters.")); return; }
    if (form.password !== form.confirmPassword) { setError(t("Passwords do not match.")); return; }
    if (!token) { setError(t("Invalid or missing reset token.")); return; }

    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: form.password }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(t(data.message || "Something went wrong."));
      }
    } catch {
      setError(t("Cannot connect to server. Make sure backend is running."));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="rp-bg">
        <div className="rp-card">
          <p className="rp-error">{t("Invalid or missing reset token.")}</p>
          <button className="rp-btn" onClick={() => navigate("/forgot-password")}>
            {t("Request New Link")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rp-bg">
      <div className="rp-card">
        {!success ? (
          <>
            <div className="rp-icon-wrap">🔒</div>
            <h2 className="rp-title">{t("Reset Password")}</h2>
            <p className="rp-desc">{t("Enter your new password below.")}</p>

            <form className="rp-form" onSubmit={handleSubmit} noValidate>
              <div className="rp-field">
                <label className="rp-label">{t("New Password")}</label>
                <div className="rp-pass-wrap">
                  <input
                    type={showPass ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    className="rp-input"
                    placeholder={t("Min. 6 characters")}
                    autoComplete="new-password"
                  />
                  <span className="rp-eye" onClick={() => setShowPass(!showPass)}>
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </span>
                </div>
              </div>

              <div className="rp-field">
                <label className="rp-label">{t("Confirm New Password")}</label>
                <div className="rp-pass-wrap">
                  <input
                    type={showConfirm ? "text" : "password"}
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    className="rp-input"
                    placeholder={t("Re-enter new password")}
                    autoComplete="new-password"
                  />
                  <span className="rp-eye" onClick={() => setShowConfirm(!showConfirm)}>
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </span>
                </div>
              </div>

              {error && <p className="rp-error">{error}</p>}

              <button type="submit" className="rp-btn" disabled={loading}>
                {loading ? <span className="rp-spinner" /> : t("Reset Password")}
              </button>
            </form>
          </>
        ) : (
          <div className="rp-success">
            <div className="rp-success-icon">✓</div>
            <h2 className="rp-title">{t("Password Reset!")}</h2>
            <p className="rp-desc">{t("Your password has been successfully changed. You can now login with your new password.")}</p>
            <button className="rp-btn" onClick={() => navigate("/login")}>
              {t("Back to Login")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}