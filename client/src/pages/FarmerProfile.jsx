import { useState, useRef, useEffect } from "react";
import Sidebar, { openSidebar } from "../components/Sidebar";
import {
  FiBell, FiCalendar, FiCamera, FiMail, FiPhone, FiUser,
  FiClock, FiLock, FiEye, FiEyeOff, FiSave, FiMenu, FiX, FiCheckCircle,
} from "react-icons/fi";
import "./Profile.css";

/* ─────────────────────────────────────────────────────────────
   INLINE PROFILE STORE — shared with Personnel & Manpower.
   Farmer edits pic/name/contact/email → Personnel reads these
   (read-only). Personnel manages position/status separately.
     import { getFarmerProfile } from "../pages/FarmerProfile";
────────────────────────────────────────────────────────────── */
const P_KEY = "pb_farmer_profile";
const DEFAULT_PROFILE = {
  fullName: "Juan Dela Cruz",
  email: "juandelacruz@email.com",
  phone: "0912 345 6789",
  avatar: "", // base64 data URL; empty → placeholder
  // read-only (managed by Owner/Admin in Personnel module):
  username: "juandelacruz",
  position: "Farmer",
  status: "Active", // Active | Inactive | On Leave
  dateJoined: "January 10, 2024",
  lastLogin: "May 15, 2024 08:25 AM",
};

function readProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(P_KEY));
    return { ...DEFAULT_PROFILE, ...(saved || {}) };
  } catch { return { ...DEFAULT_PROFILE }; }
}
function writeProfile(p) {
  try { localStorage.setItem(P_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
export function getFarmerProfile() { return readProfile(); }

const STATUS_STYLE = {
  "Active":   { bg: "#eaf7f1", color: "#2e9e6b", dot: "🟢" },
  "Inactive": { bg: "#f0efec", color: "#7a7469", dot: "⚪" },
  "On Leave": { bg: "#fdf2e6", color: "#e0892f", dot: "🟠" },
};

/* ─────────────────────────────────────────────────────────────
   INLINE STYLES
────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────
   COMPONENT
────────────────────────────────────────────────────────────── */
export default function FarmerProfile({ embedded = false, onBack }) {
  const [saved, setSaved] = useState(() => readProfile());
  const [form, setForm] = useState(saved);
  const [toast, setToast] = useState("");
  const [showPass, setShowPass] = useState(false);
  const fileRef = useRef(null);
  const toastRef = useRef(null);

  useEffect(() => () => clearTimeout(toastRef.current), []);

  const dirty =
    form.fullName !== saved.fullName ||
    form.email !== saved.email ||
    form.phone !== saved.phone ||
    form.avatar !== saved.avatar;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onPickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("avatar", reader.result);
    reader.readAsDataURL(file);
  };

  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(""), 3000);
  };

  const onSave = () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      flash("Full Name and Email are required.");
      return;
    }
    writeProfile(form);        // → syncs to Personnel & Manpower
    setSaved(form);
    flash("Profile saved. Personnel record updated.");
  };

  const onCancel = () => setForm(saved);

  const st = STATUS_STYLE[saved.status] || STATUS_STYLE["Active"];
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className={embedded ? "pf-embedded" : "pf-page"}>
      {!embedded && <Sidebar />}

      <div className="pf-main">
        {/* Top bar */}
        <div className="pf-top">
          <div className="pf-heading">
            {!embedded && <button className="pf-hamburger" onClick={openSidebar} aria-label="Open menu"><FiMenu /></button>}
            <p className="pf-crumb">
              {embedded
                ? <span className="pf-crumb-link" onClick={onBack}>SETTINGS</span>
                : <span>SETTINGS</span>}{" "}
              <span>›</span> <span className="pf-crumb-current">MY PROFILE</span>
            </p>
          </div>
        </div>

        <div className="pf-layout">
          {/* LEFT — profile summary card */}
          <div className="pf-card pf-side">
            <div className="pf-avatar-wrap">
              <div className="pf-avatar">
                {form.avatar ? <img src={form.avatar} alt="Profile" /> : <FiUser />}
              </div>
              <button className="pf-cam" onClick={() => fileRef.current?.click()} aria-label="Change photo"><FiCamera /></button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
            </div>
            <h3 className="pf-name">{form.fullName || "—"}</h3>
            <p className="pf-pos">{saved.position}</p>

            <div className="pf-divider" />

            <div className="pf-info-list">
              <div className="pf-info-row"><FiMail />{form.email || "—"}</div>
              <div className="pf-info-row"><FiPhone />{form.phone || "—"}</div>
              <div className="pf-info-row"><FiCalendar />Joined: {saved.dateJoined}</div>
              <div className="pf-info-row"><FiUser />Position: {saved.position}</div>
              <div className="pf-info-row"><FiClock />Last Login: {saved.lastLogin}</div>
            </div>

            <button className="pf-changepass" onClick={() => setShowPass(true)}>
              <FiLock /> Change Password
            </button>
          </div>

          {/* RIGHT — personal information (editable + read-only) */}
          <div className="pf-card pf-section">
            <div className="pf-section-head">
              <div className="pf-section-ico"><FiUser /></div>
              <h2>Personal Information</h2>
            </div>

            <div className="pf-grid">
              <div className="pf-field">
                <label className="pf-label">Full Name<span className="req">*</span></label>
                <input className="pf-input" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Full name" />
              </div>
              <div className="pf-field">
                <label className="pf-label">Email Address<span className="req">*</span></label>
                <input className="pf-input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@email.com" />
              </div>

              <div className="pf-field">
                <label className="pf-label">Contact Number</label>
                <input className="pf-input" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0912 345 6789" />
              </div>
              <div className="pf-field">
                <label className="pf-label">Username</label>
                <input className="pf-input readonly" value={saved.username} readOnly tabIndex={-1} />
                <span className="pf-readonly-note">Read-only</span>
              </div>

              <div className="pf-field">
                <label className="pf-label">Position</label>
                <input className="pf-input readonly" value={saved.position} readOnly tabIndex={-1} />
                <span className="pf-readonly-note">Managed by Admin</span>
              </div>
              <div className="pf-field">
                <label className="pf-label">Account Status</label>
                <span className="pf-status-pill" style={{ background: st.bg, color: st.color }}>
                  {st.dot} {saved.status}
                </span>
                <span className="pf-readonly-note">Only Owner/Admin can change this</span>
              </div>

              <div className="pf-field">
                <label className="pf-label">Date Joined</label>
                <input className="pf-input readonly" value={saved.dateJoined} readOnly tabIndex={-1} />
              </div>
              <div className="pf-field">
                <label className="pf-label">Last Login</label>
                <input className="pf-input readonly" value={saved.lastLogin} readOnly tabIndex={-1} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="pf-actions">
          <button className="pf-btn pf-btn-cancel" onClick={onCancel} disabled={!dirty}>Cancel</button>
          <button className="pf-btn pf-btn-save" onClick={onSave} disabled={!dirty}><FiSave /> Save Changes</button>
        </div>
      </div>

      {toast && <div className="pf-toast"><FiCheckCircle /> {toast}</div>}

      {/* Change Password modal */}
      {showPass && <ChangePasswordModal onClose={() => setShowPass(false)} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CHANGE PASSWORD MODAL (frontend validation only)
────────────────────────────────────────────────────────────── */
function ChangePasswordModal({ onClose }) {
  const [vals, setVals] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [msg, setMsg] = useState(null); // { type, text }

  const set = (k, v) => setVals((s) => ({ ...s, [k]: v }));
  const toggle = (k) => setShow((s) => ({ ...s, [k]: !s[k] }));

  const submit = () => {
    if (!vals.current || !vals.next || !vals.confirm) {
      return setMsg({ type: "error", text: "Please fill in all password fields." });
    }
    if (vals.next.length < 8) {
      return setMsg({ type: "error", text: "New password must be at least 8 characters." });
    }
    if (vals.next === vals.current) {
      return setMsg({ type: "error", text: "New password must be different from the current one." });
    }
    if (vals.next !== vals.confirm) {
      return setMsg({ type: "error", text: "New password and confirmation do not match." });
    }
    setMsg({ type: "success", text: "Password updated successfully!" });
    setTimeout(onClose, 1300);
  };

  const fields = [
    { label: "Current Password", k: "current", placeholder: "Enter current password" },
    { label: "New Password", k: "next", placeholder: "Enter new password" },
    { label: "Confirm New Password", k: "confirm", placeholder: "Re-enter new password" },
  ];

  return (
    <div className="pf-overlay" onClick={onClose}>
      <div className="pf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pf-modal-head">
          <h3>Change Password</h3>
          <button onClick={onClose} aria-label="Close"><FiX /></button>
        </div>
        <p className="pf-modal-sub">Use at least 8 characters. Keep your account secure.</p>

        {msg && (
          <div className={`pf-msg ${msg.type}`}>
            {msg.type === "success" ? <FiCheckCircle /> : <FiX />} {msg.text}
          </div>
        )}

        {fields.map((f) => (
          <div className="pf-pass-field" key={f.k}>
            <label>{f.label}</label>
            <div className="pf-pass-input">
              <input
                type={show[f.k] ? "text" : "password"}
                value={vals[f.k]}
                onChange={(e) => set(f.k, e.target.value)}
                placeholder={f.placeholder}
              />
              <button className="pf-eye" onClick={() => toggle(f.k)} aria-label="Toggle visibility" tabIndex={-1}>
                {show[f.k] ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>
        ))}

        <div className="pf-modal-btns">
          <button className="pf-mb-cancel" onClick={onClose}>Cancel</button>
          <button className="pf-mb-update" onClick={submit}>Update Password</button>
        </div>
      </div>
    </div>
  );
}
