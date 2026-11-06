import { useLanguage } from "../i18n/LanguageContext";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import "./Signup.css";

const BASE_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/v1`;

export default function Signup() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [assignedRole, setAssignedRole] = useState("Farmer");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkFirstAccount = async () => {
      try {
        const response = await fetch(`${BASE_URL}/auth/first-account-check`);
        const data = await response.json();
        if (!cancelled && data?.isFirstAccount) {
          setAssignedRole("Owner");
        }
      } catch (err) {
        console.error(err);
      }
    };

    checkFirstAccount();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const validate = () => {
    if (!form.name.trim()) return t("Full name is required.");
    if (!form.email.trim()) return t("Email is required.");
    if (form.password.length < 6)
      return t("Password must be at least 6 characters.");
    if (form.password !== form.confirmPassword)
      return t("Passwords do not match.");

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validation = validate();

    if (validation) {
      setError(validation);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${BASE_URL}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(t(data.message || "Registration failed."));
        return;
      }

      if (data.user.role === "Owner") {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        navigate("/dashboard");
        return;
      }

      localStorage.setItem(
        "pendingUser",
        JSON.stringify(data.user)
      );

      navigate("/pending-approval");
    } catch (error) {
      console.error(error);
      setError(t("Cannot connect to the server."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="su-bg">
      <div className="su-card">
        <h2 className="su-title">{t("Create Account")}</h2>

        <form className="su-form" onSubmit={handleSubmit} noValidate>

          <div className="su-field">
            <label className="su-label">{t("Full Name")}</label>

            <input
              type="text"
              name="name"
              className="su-input"
              placeholder="Juan Dela Cruz"
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
            />
          </div>

          <div className="su-field">
            <label className="su-label">{t("Email")}</label>

            <input
              type="email"
              name="email"
              className="su-input"
              placeholder="you@email.com"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
            />
          </div>

          <div className="su-field">
            <label className="su-label">{t("Password")}</label>

            <div className="su-pass-wrap">
              <input
                type={showPass ? "text" : "password"}
                name="password"
                className="su-input"
                placeholder={t("Minimum 6 characters")}
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
              />

              <span
                className="su-eye"
                onClick={() => setShowPass(!showPass)}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </span>
            </div>
          </div>

          <div className="su-field">
            <label className="su-label">{t("Confirm Password")}</label>

            <div className="su-pass-wrap">
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                className="su-input"
                placeholder={t("Confirm password")}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={handleChange}
              />

              <span
                className="su-eye"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </span>
            </div>
          </div>

          <div className="su-field">
            <label className="su-label">{t("Role")}</label>

            <div className="su-select-wrap">
              <input
                type="text"
                className="su-select"
                value={t(assignedRole)}
                readOnly
                disabled
              />
            </div>
          </div>

          <div
            style={{
              background: "#fff8e8",
              border: "1px solid #E4AF1F",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "12px",
              color: "#6b4a00",
            }}
          >
            {assignedRole === "Owner"
              ? t("As the first account, you'll be registered as the Owner and can log in right away.")
              : t("Farmer account requires Owner approval before you can log in.")}
          </div>

          {error && <p className="su-error">{error}</p>}

          <button
            type="submit"
            className="su-btn"
            disabled={loading}
          >
            {loading ? <span className="su-spinner" /> : t("Register")}
          </button>

        </form>

        <p className="su-login">
          {t("Already have an account?")}{" "}
          <span
            className="su-login-link"
            onClick={() => navigate("/login")}
          >
            {t("Login")}
          </span>
        </p>
      </div>
    </div>
  );
}