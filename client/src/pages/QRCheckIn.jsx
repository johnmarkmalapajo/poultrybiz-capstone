import { useState, useEffect } from "react";
import { FiCheckCircle, FiClock, FiCalendar, FiLogIn, FiAlertCircle } from "react-icons/fi";
import { BsQrCodeScan } from "react-icons/bs";
import "./QRCheckIn.css";

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

// Demo fallback so the page is testable before auth/backend is wired.
// Remove this once real login populates localStorage.
const DEMO_USER = { id: "f1", name: "Juan Dela Cruz", role: "Farm Worker" };

export default function QRCheckIn() {
  const [now, setNow] = useState(new Date());
  const [done, setDone] = useState(null); // { name, time, date }

  const user = getLoggedInUser() || DEMO_USER;

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });

  const checkIn = () => {
    if (!user) return;
    const t = new Date();
    const time = t.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const date = t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const entry = {
      _id: `qr-${Date.now()}`,
      date, timestamp: time, timeIn: time, timeOut: "—",
      status: "Present", remarks: "QR check-in", source: "qr", offset: 0,
    };
    try {
      const all = JSON.parse(localStorage.getItem("pb_attendance") || "{}");
      all[user.id] = [entry, ...(all[user.id] || [])];
      localStorage.setItem("pb_attendance", JSON.stringify(all));
    } catch (e) { /* ignore */ }
    setDone({ name: user.name, time, date });
  };

  return (
    <div className="qc-page">
      <div className="qc-card">

        {/* Brand header */}
        <div className="qc-brand">
          <div className="qc-logo"><BsQrCodeScan /></div>
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

                <button className="qc-btn" onClick={checkIn}>
                  <FiLogIn /> Check In
                </button>

                <p className="qc-hint">You're identified from your account. Your check-in is time-stamped automatically.</p>
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
            <h2>You're Checked In!</h2>
            <div className="qc-success-name">{done.name}</div>
            <div className="qc-success-meta">
              <span><FiClock /> {done.time}</span>
              <span><FiCalendar /> {done.date}</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}