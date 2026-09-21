import { useState, useEffect } from "react";
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

  const checkIn = async () => {
    if (!user) return;
    const t = new Date();
    const time = t.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const date = t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    try {
  const result = await createAttendance();

  try {
    window.dispatchEvent(new Event("pb_data_changed"));
  } catch (e) { /* ignore */ }

  setDone({
    name: user.name,
    time,
    date,
    checkOut: result?.attendance?.timeOut || null,
  });
} catch (err) {
  setError(err?.message || "Couldn't record your attendance.");
}
  }

  // ── AUTO check-in on scan ──
  // Logged in + QR scanned = attendance is recorded automatically (no button).
  // If they already checked in today, show that record instead of duplicating.
  useEffect(() => {
    if (!user || done) return;
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    getPersonnelAttendance(user.id)
      .then((data) => {
        const list = Array.isArray(data) ? data : data.records || data.data || [];
        const existing = list.find((e) => e.date === today) || null;
        if (existing) {
          setDone({ name: user.name, time: existing.timeIn || existing.timestamp, date: existing.date, already: true });
        } else {
          checkIn();
        }
      })
      .catch(() => checkIn()); // if we can't check for an existing entry, still try to check in
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
            <h2>{done.already ? "Already Checked In Today" : "You're Checked In!"}</h2>
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

