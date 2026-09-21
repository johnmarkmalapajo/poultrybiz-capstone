import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import "./Signup.css";

const BASE_URL = "http://localhost:5000/api/v1";

export default function Signup() {
  const navigate = useNavigate();

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
    if (!form.name.trim()) return "Full name is required.";
    if (!form.email.trim()) return "Email is required.";
    if (form.password.length < 6)
      return "Password must be at least 6 characters.";
    if (form.password !== form.confirmPassword)
      return "Passwords do not match.";

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
        setError(data.message || "Registration failed.");
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
      setError("Cannot connect to the server.");
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
              className="su-input"
              placeholder="Juan Dela Cruz"
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
            />
          </div>

          <div className="su-field">
            <label className="su-label">Email</label>

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
            <label className="su-label">Password</label>

            <div className="su-pass-wrap">
              <input
                type={showPass ? "text" : "password"}
                name="password"
                className="su-input"
                placeholder="Minimum 6 characters"
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
            <label className="su-label">Confirm Password</label>

            <div className="su-pass-wrap">
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                className="su-input"
                placeholder="Confirm password"
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
            <label className="su-label">Role</label>

            <div className="su-select-wrap">
              <input
                type="text"
                className="su-select"
                value={assignedRole}
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
              ? "As the first account, you'll be registered as the Owner and can log in right away."
              : "Farmer account requires Owner approval before you can log in."}
          </div>

          {error && <p className="su-error">{error}</p>}

          <button
            type="submit"
            className="su-btn"
            disabled={loading}
          >
            {loading ? <span className="su-spinner" /> : "Register"}
          </button>

        </form>

        <p className="su-login">
          Already have an account?{" "}
          <span
            className="su-login-link"
            onClick={() => navigate("/login")}
          >
            Login
          </span>
        </p>
      </div>
    </div>
  );
}