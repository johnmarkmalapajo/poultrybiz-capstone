import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, ArrowLeft } from "lucide-react";
import "./ForgotPassword.css";

const BASE_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/v1`;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail]     = useState("");
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Please enter your email."); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.message || "Something went wrong.");
      }
    } catch {
      setError("Cannot connect to server. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fp-bg">
      <div className="fp-card">

        <button className="fp-back" onClick={() => navigate("/login")}>
          <ArrowLeft size={20} style={{ transform: 'scaleX(1.3)' }} />
        </button>

        {!success ? (
          <>
            <div className="fp-icon-wrap">
              <Mail size={32} color="#e8a020" />
            </div>
            <h2 className="fp-title">Forgot Password?</h2>
            <p className="fp-desc">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <form className="fp-form" onSubmit={handleSubmit} noValidate>
              <div className="fp-field">
                <label className="fp-label">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="fp-input"
                  placeholder="you@email.com"
                  autoComplete="email"
                />
              </div>

              {error && <p className="fp-error">{error}</p>}

              <button type="submit" className="fp-btn" disabled={loading}>
                {loading ? <span className="fp-spinner" /> : "Send Reset Link"}
              </button>
            </form>
          </>
        ) : (
          <div className="fp-success">
            <div className="fp-success-icon">✓</div>
            <h2 className="fp-title">Check Your Email</h2>
            <p className="fp-desc">
              We sent a password reset link to <strong>{email}</strong>.
              Check your inbox and follow the instructions.
            </p>
            <p className="fp-desc-small">
              Didn't receive it? Check your spam folder or{" "}
              <span className="fp-resend" onClick={() => setSuccess(false)}>
                try again
              </span>.
            </p>
            <button className="fp-btn" onClick={() => navigate("/login")}>
              Back to Login
            </button>
          </div>
        )}

      </div>
    </div>
  );
}