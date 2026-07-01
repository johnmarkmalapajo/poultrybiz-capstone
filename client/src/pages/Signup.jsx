// src/pages/Signup.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import "./Signup.css";

const BASE_URL = "http://localhost:5000/api/v1";
const ROLES    = ["Admin", "Farmer"];

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", email: "", password: "", confirmPassword: "", role: "",
  });
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const validate = () => {
    if (!form.name.trim())                       return "Full name is required.";
    if (!form.email.trim())                      return "Email is required.";
    if (form.password.length < 6)               return "Password must be at least 6 characters.";
    if (form.password !== form.confirmPassword) return "Passwords do not match.";
    if (!form.role)                              return "Please select a role.";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, email: form.email,
          password: form.password, role: form.role,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // ── Mark as new user ──
        const existingUsers = JSON.parse(localStorage.getItem("knownUsers") || "[]");
        existingUsers.push(data.user.id);
        localStorage.setItem("knownUsers", JSON.stringify(existingUsers));
        localStorage.setItem("isNewUser", "true");

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        navigate("/dashboard");
      } else {
        setError(data.message || "Registration failed. Try again.");
      }
    } catch {
      setError("Cannot connect to server. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="su-bg">
      <div className="su-card">
        <h2 className="su-title">Create Account</h2>
        <form className="su-form" onSubmit={handleSubmit} noValidate>

          <div className="su-field">
            <label className="su-label">Full Name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="su-input"
              placeholder="Juan Dela Cruz"
              autoComplete="name"
            />
          </div>

          <div className="su-field">
            <label className="su-label">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="su-input"
              placeholder="you@email.com"
              autoComplete="email"
            />
          </div>

          <div className="su-field">
            <label className="su-label">Password</label>
            <div className="su-pass-wrap">
              <input
                type={showPass ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                className="su-input"
                placeholder="Min. 6 characters"
                autoComplete="new-password"
              />
              <span className="su-eye" onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </span>
            </div>
          </div>

          <div className="su-field">
            <label className="su-label">Confirm Password</label>
            <div className="su-pass-wrap">
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                className="su-input"
                placeholder="Confirm password"
                autoComplete="new-password"
              />
              <span className="su-eye" onClick={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </span>
            </div>
          </div>

          <div className="su-field">
            <label className="su-label">Role</label>
            <div className="su-select-wrap">
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="su-select"
              >
                <option value="" disabled>Select role...</option>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {form.role && (
            <div style={{
              background: form.role === "Admin" ? "#e8f5e9" : "#fff3e0",
              border: `1px solid ${form.role === "Admin" ? "#a5d6a7" : "#ffcc80"}`,
              borderRadius: "8px", padding: "8px 14px", fontSize: "12px",
              color: form.role === "Admin" ? "#2e7d32" : "#e65100",
            }}>
              {form.role === "Admin"
                ? "Admin — Full access including Sales & Financial data"
                : "Farmer — Access to Records, Inventory, and Farm operations only"}
            </div>
          )}

          {error && <p className="su-error">{error}</p>}

          <button type="submit" className="su-btn" disabled={loading}>
            {loading ? <span className="su-spinner" /> : "Register"}
          </button>
        </form>

        <p className="su-login">
          Already have an account?{" "}
          <span className="su-login-link" onClick={() => navigate("/login")}>Login</span>
        </p>
      </div>
    </div>
  );
}