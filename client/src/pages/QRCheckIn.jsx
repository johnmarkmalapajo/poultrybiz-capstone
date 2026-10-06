import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiCheckCircle, FiClock, FiCalendar, FiLogIn, FiAlertCircle } from "react-icons/fi";
import "./QRCheckIn.css";
import { createAttendance, getPersonnelAttendance } from "../api/personnelManpower";
import logo from "../assets/logo.png";

const initials = (name) =>
  (name ? name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") : "?").toUpperCase();

// Read the logged-in account from localStorage (tolerant to your auth schema).
// When a personnel scans the QR they're already logged in, so their name fills
// in automatically — no dropdown needed. Adjust the keys/fields to match your auth.
const getLoggedInUser = () => {
  const keys = ["pb_user", "user", "currentUser", "authUser", "loggedInUser"];
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const u = JSON.parse(raw);
      const name =
        u.fullName || u.name ||
        [u.firstName, u.lastName].filter(Boolean).join(" ") ||
        u.username || "";
      const id = u._id || u.id || u.personnelId || u.userId || name;
      const role = u.position || u.role || u.accountRole || u.userRole || "Personnel";
      if (name || id) return { id, name: name || "Personnel", role };
    } catch (e) { /* ignore */ }
  }
  return null;
};

const RETURN_PATH = "/attendance/check-in";

export default function QRCheckIn() {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [done, setDone] = useState(null); // { name, time, date }

  const user = getLoggedInUser(); // no demo fallback — identity must come from a real login

  // ── Login-gate: if nobody is logged in on this device, send them to login
  //    first, then bring them back here to check in. ──
  useEffect(() => {
    if (!user) {
      try { localStorage.setItem("pb_post_login_redirect", RETURN_PATH); } catch (e) { /* ignore */ }
      navigate(`/login?redirect=${encodeURIComponent(RETURN_PATH)}`, { replace: true });
    }
  }, [user, navigate]);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });

  const [error, setError] = useState("");

  const fmtTime = (d) =>
    new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (d) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // The same scan endpoint toggles: 1st scan of the day = check-in, 2nd = check-out.
  // The server tells us which one happened, so the screen can say so.
  const record = async () => {
    if (!user) return;
    try {
      const result = await createAttendance();
      const att = result?.attendance || {};
      const isOut =
        result?.action === "check-out" ||
        (result?.action == null && /out/i.test(result?.message || ""));
      const when = isOut ? (att.timeOut || new Date()) : (att.timeIn || new Date());
      const state = {
        name: user.name,
        action: isOut ? "out" : "in",
        time: fmtTime(when),
        date: fmtDate(when),
      };
      try { sessionStorage.setItem("pb_qr_last", JSON.stringify({ uid: user.id, ts: Date.now(), state })); } catch (e) { /* ignore */ }
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch (e) { /* ignore */ }
      setDone(state);
    } catch (err) {
      const msg = err?.message || "Couldn't record your attendance.";
      if (/already completed/i.test(msg)) {
        const now = new Date();
        setDone({ name: user.name, action: "completed", time: fmtTime(now), date: fmtDate(now) });
      } else {
        setError(msg);
      }
    }
  };

  // ── AUTO record on scan ──
  // Logged in + QR scanned = attendance is recorded automatically (no button).
  // A page refresh within a few seconds re-shows the last result instead of
  // scanning again, so a refresh can't accidentally turn a check-in into a check-out.
  const started = useRef(false);
  useEffect(() => {
    if (!user || done || started.current) return;
    started.current = true;
    try {
      const raw = sessionStorage.getItem("pb_qr_last");
      if (raw) {
        const last = JSON.parse(raw);
        if (last && last.uid === user.id && Date.now() - last.ts < 20000) {
          setDone(last.state);
          return;
        }
      }
    } catch (e) { /* ignore */ }
    record();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user && user.id]);

  return (
    <div className="qc-page">
      {!user ? (
        <div className="qc-card">
          <div className="qc-header">
            <div className="qc-logo"><img src="assets/logo.png" alt="PoultryBiz" style={{ width: 40, height: 40, objectFit: "contain" }} /></div>
            <div className="qc-brand"><h1>PoultryBiz</h1><p>Attendance Check-In</p></div>
          </div>
          <div className="qc-notice">
            <FiAlertCircle />
            <div>
              <strong>Login required</strong>
              <p>Please log in to your account first to check in. You'll be identified from your account and time-stamped automatically.</p>
            </div>
          </div>
          <button className="qc-btn" onClick={() => navigate(`/login?redirect=${encodeURIComponent(RETURN_PATH)}`)}>
            <FiLogIn /> Log In to Check In
          </button>
        </div>
      ) : (
      <div className="qc-card">

        {/* Brand header */}
        <div className="qc-brand">
          <div className="qc-logo"><img src={logo} alt="PoultryBiz" style={{ width: 55, height: 55, objectFit: "contain" }} /></div>
          <div>
            <h1>PoultryBiz</h1>
            <p>Attendance Check-In</p>
          </div>
        </div>

        {!done ? (
          <>
            {/* Live clock */}
            <div className="qc-clock">
              <div className="qc-time"><FiClock /> {timeStr}</div>
              <div className="qc-date"><FiCalendar /> {dateStr}</div>
            </div>

            {user ? (
              <>
                {/* Auto-detected logged-in personnel (no dropdown) */}
                <div className="qc-preview">
                  <span className="qc-avatar">{initials(user.name)}</span>
                  <div>
                    <div className="qc-preview-name">{user.name}</div>
                    <div className="qc-preview-role">{user.role}</div>
                  </div>
                </div>

                {error ? (
                  <div className="pb-error-banner">{error}</div>
                ) : (
                  <p className="qc-hint">Recording your attendance…</p>
                )}
              </>
            ) : (
              <div className="qc-notice">
                <FiAlertCircle />
                <span>Please log in first, then scan the QR to check in.</span>
              </div>
            )}
          </>
        ) : (
          <div className="qc-success">
            <div className="qc-success-icon"><FiCheckCircle /></div>
            <h2>
              {done.action === "out"
                ? "You're Checked Out!"
                : done.action === "completed"
                ? "Attendance Already Completed Today"
                : "You're Checked In!"}
            </h2>
            <div className="qc-success-name">{done.name}</div>
            <div className="qc-success-meta">
              <span><FiClock /> {done.time}</span>
              <span><FiCalendar /> {done.date}</span>
            </div>
          </div>
        )}

      </div>
      )}
    </div>
  );
}