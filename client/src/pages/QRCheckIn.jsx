import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiCheckCircle, FiClock, FiCalendar, FiLogIn, FiAlertCircle, FiInfo, FiRefreshCw } from "react-icons/fi";
import "./QRCheckIn.css";
import { createAttendance } from "../api/personnelManpower";
import { getToken, loginUrl } from "../api/session";
import logo from "../assets/logo.png";

const initials = (name) =>
  (name ? name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") : "?").toUpperCase();

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Display-only name while the request is running. The backend identifies the
// person from the session token -- this value is never sent as identity.
const storedUserName = () => {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    return u?.name || "";
  } catch {
    return "";
  }
};

const RESULT_TITLES = {
  "check-in": "You're Checked In!",
  "check-out": "You're Checked Out!",
  "already-checked-in": "Already Checked In",
  "already-checked-out": "Already Checked Out",
  completed: "Attendance Already Completed Today",
};

export default function QRCheckIn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qr = searchParams.get("qr") || "";
  const hasToken = !!getToken();

  // Path to come back to after logging in (keeps the QR code, no credentials).
  const returnPath = `/attendance/check-in${qr ? `?qr=${encodeURIComponent(qr)}` : ""}`;

  const [now, setNow] = useState(new Date());
  const [status, setStatus] = useState(!qr ? "invalid" : hasToken ? "recording" : "login");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const started = useRef(false);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const showResult = useCallback((data) => {
    const att = data?.attendance || {};
    const action = data?.action || "check-in";
    const when =
      action === "check-out" || action === "already-checked-out"
        ? att.timeOut || new Date()
        : att.timeIn || new Date();

    setResult({
      action,
      message: data?.message || "",
      name: data?.person?.name || storedUserName(),
      role: data?.person?.position || data?.person?.role || "",
      time: fmtTime(when),
      date: fmtDate(when),
    });
    setStatus("done");

    try { window.dispatchEvent(new Event("pb_data_changed")); } catch { /* ignore */ }
  }, []);

  const showError = useCallback((err) => {
    if (err?.status === 401) {
      // api/client.js has already cleared the session and is opening Login,
      // which returns here afterwards.
      setStatus("login");
    } else if (err?.body?.code === "ATTENDANCE_COMPLETED") {
      const att = err.body.attendance || {};
      setResult({
        action: "completed",
        message: err.message,
        name: err.body.person?.name || storedUserName(),
        role: err.body.person?.position || err.body.person?.role || "",
        time: att.timeOut ? fmtTime(att.timeOut) : "",
        date: fmtDate(att.timeOut || new Date()),
      });
      setStatus("done");
    } else if (err?.body?.code === "INVALID_QR") {
      setError(err.message);
      setStatus("invalid");
    } else {
      setError(err?.message || "Couldn't record your attendance. Please try again.");
      setStatus("error");
    }
  }, []);

  // One request at a time; the backend also ignores repeated scans.
  const record = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;

    createAttendance(qr)
      .then(showResult, showError)
      .finally(() => {
        inFlight.current = false;
      });
  }, [qr, showResult, showError]);

  // On open: no login -> go to Login first (attendance is never recorded
  // before login). Logged in -> record automatically; the backend validates
  // the session and the QR code. The ref keeps React Strict Mode's second
  // effect run from sending a second request.
  useEffect(() => {
    if (started.current || !qr) return;
    started.current = true;

    if (!hasToken) {
      navigate(loginUrl(returnPath, "attendance"), { replace: true });
      return;
    }

    record();
  }, [qr, hasToken, navigate, record, returnPath]);

  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });

  const isRepeat = result && /^already|completed/.test(result.action);

  return (
    <div className="qc-page">
      <div className="qc-card">
        <div className="qc-brand">
          <div className="qc-logo">
            <img src={logo} alt="PoultryBiz" />
          </div>
          <div>
            <h1>PoultryBiz</h1>
            <p>Attendance Check-In</p>
          </div>
        </div>

        {status === "invalid" && (
          <div className="qc-notice qc-notice-error" role="alert">
            <FiAlertCircle />
            <div>
              <strong>Invalid attendance QR code</strong>
              <p>{error || "This link is missing the farm's attendance code. Please scan the official QR code provided by the Owner."}</p>
            </div>
          </div>
        )}

        {status === "login" && (
          <>
            <div className="qc-notice" role="status">
              <FiInfo />
              <div>
                <strong>Login required</strong>
                <p>Log in to your account to record your attendance. You'll come back here automatically afterwards.</p>
              </div>
            </div>
            <button className="qc-btn" onClick={() => navigate(loginUrl(returnPath, "attendance"))}>
              <FiLogIn /> Log In to Continue
            </button>
          </>
        )}

        {(status === "recording" || status === "error") && (
          <>
            <div className="qc-clock">
              <div className="qc-time"><FiClock /> {timeStr}</div>
              <div className="qc-date"><FiCalendar /> {dateStr}</div>
            </div>

            {storedUserName() && (
              <div className="qc-preview">
                <span className="qc-avatar">{initials(storedUserName())}</span>
                <div>
                  <div className="qc-preview-name">{storedUserName()}</div>
                  <div className="qc-preview-role">Logged-in account</div>
                </div>
              </div>
            )}

            {status === "recording" ? (
              <p className="qc-hint" role="status">
                <span className="qc-spinner" aria-hidden="true" /> Recording your attendance…
              </p>
            ) : (
              <>
                <div className="qc-notice qc-notice-error" role="alert">
                  <FiAlertCircle />
                  <div>
                    <strong>Attendance not recorded</strong>
                    <p>{error}</p>
                  </div>
                </div>
                <button
                  className="qc-btn"
                  onClick={() => {
                    setError("");
                    setStatus("recording");
                    record();
                  }}
                >
                  <FiRefreshCw /> Try Again
                </button>
              </>
            )}
          </>
        )}

        {status === "done" && result && (
          <div className={`qc-success ${isRepeat ? "qc-success-repeat" : ""}`} role="status">
            <div className="qc-success-icon">
              {isRepeat ? <FiInfo /> : <FiCheckCircle />}
            </div>
            <h2>{RESULT_TITLES[result.action] || "Attendance Recorded"}</h2>
            <div className="qc-success-name">{result.name}</div>
            {result.role && <div className="qc-success-role">{result.role}</div>}
            {(result.time || result.date) && (
              <div className="qc-success-meta">
                {result.time && <span><FiClock /> {result.time}</span>}
                {result.date && <span><FiCalendar /> {result.date}</span>}
              </div>
            )}
            {isRepeat && result.message && <p className="qc-success-note">{result.message}</p>}
          </div>
        )}
      </div>
    </div>
  );
}