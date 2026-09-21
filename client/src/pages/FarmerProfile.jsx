import { useState, useRef, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import {
  FiBell, FiCalendar, FiCamera, FiMail, FiPhone, FiUser,
  FiClock, FiLock, FiEye, FiEyeOff, FiSave, FiX, FiCheckCircle,
} from "react-icons/fi";
import "./Profile.css";
import {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  uploadAvatar,
} from "../api/profile";
import { updateStoredUser } from "../hooks/useUser";

const EMPTY_PROFILE = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  avatar: "",
  dateJoined: "",
  status: "Active",
  position: "",
  employmentStatus: "",
  role: "Farmer",
  lastLogin: "",
  language: "English",
  timezone: "(GMT+08:00) Asia/Manila",
  emailNotif: true,
  loginAlerts: true,
};

const STATUS_STYLE = {
  "Active":   { bg: "#eaf7f1", color: "#2e9e6b"},
  "Inactive": { bg: "#f0efec", color: "#7a7469" },
};


export default function FarmerProfile({ embedded = false, onBack }) {
  const [saved, setSaved] = useState(EMPTY_PROFILE);
  const [form, setForm] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const fileRef = useRef(null);
  const toastRef = useRef(null);

  useEffect(() => () => clearTimeout(toastRef.current), []);

  useEffect(() => {
  setLoading(true);
  getMyProfile()
    .then((data) => {
      console.log("PROFILE API:", data);

      const p = { ...EMPTY_PROFILE, ...(data.record || data.data || data) };

      console.log("PROFILE OBJECT:", p);

      setSaved(p);
      setForm(p);
    })
      .catch((err) => setError(err?.message || "Couldn't load your profile."))
      .finally(() => setLoading(false));
  }, []);

  const dirty =
    form.fullName !== saved.fullName ||
    form.email !== saved.email ||
    form.phone !== saved.phone ||
    form.avatar !== saved.avatar;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onPickPhoto = async (e) => {
  const file = e.target.files?.[0];

  if (!file) return;

  try {
    setSaving(true);

    const result = await uploadAvatar(file);

    const avatar = result.avatar;

    setSaved((prev) => ({
      ...prev,
      avatar,
    }));

    setForm((prev) => ({
      ...prev,
      avatar,
    }));

    updateStoredUser({ avatar });

    flash("Profile picture updated successfully.");
  } catch (err) {
    setError(err.message || "Unable to upload profile picture.");
  } finally {
    setSaving(false);
  }
};

  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(""), 3000);
  };

  const onSave = async () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      flash("Full Name and Email are required.");
      return;
    }
    setSaving(true); setError("");
    try {
      const updated = await updateMyProfile({ fullName: form.fullName, email: form.email, phone: form.phone, avatar: form.avatar });
      const p = { ...form, ...(updated?.record || updated?.data || updated || {}) };
      setSaved(p);
      setForm(p);
      updateStoredUser({ name: p.fullName, email: p.email, avatar: p.avatar });
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { }
      flash("Profile saved. Personnel record updated.");
    } catch (err) {
      setError(err?.message || "Couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => setForm(saved);

  const st = STATUS_STYLE[saved.employmentStatus] || STATUS_STYLE["Active"];
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className={embedded ? "pf-embedded" : "pf-page"}>
      {!embedded && <Sidebar />}

      <div className="pf-main">
        {}

        {error && <div className="pb-error-banner">{error}</div>}
        {loading && <p className="pb-loading-text">Loading your profile...</p>}

        <div className="pf-layout">
          {}
          <div className="pf-card pf-side">
            <div className="pf-avatar-wrap">
              <div className="pf-avatar">
                {form.avatar ? 
                <img
                  src={
                    form.avatar
                      ? `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${form.avatar}`
                      : ""
                  }
                  alt="Profile"
              /> : 
              <FiUser />}
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

          {}
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
                <label className="pf-label">Position</label>
                <input className="pf-input readonly" value={saved.position} readOnly tabIndex={-1} />
              </div>
              <div className="pf-field">
                <label className="pf-label">Employment Status</label>
                <span className="pf-status-pill" style={{ background: st.bg, color: st.color }}>
                  {st.dot} {saved.employmentStatus || "—"}
                </span>
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

        {}
        <div className="pf-actions">
          <button className="pf-btn pf-btn-cancel" onClick={onCancel} disabled={!dirty || saving}>Cancel</button>
          <button className="pf-btn pf-btn-save" onClick={onSave} disabled={!dirty || saving}><FiSave /> {saving ? "Saving..." : "Save Changes"}</button>
        </div>
      </div>

      {toast && <div className="pf-toast"><FiCheckCircle /> {toast}</div>}

      {}
      {showPass && <ChangePasswordModal onClose={() => setShowPass(false)} />}
    </div>
  );
}

function ChangePasswordModal({ onClose }) {
  const [vals, setVals] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [msg, setMsg] = useState(null);  const [submitting, setSubmitting] = useState(false);

  const set = (k, v) => setVals((s) => ({ ...s, [k]: v }));
  const toggle = (k) => setShow((s) => ({ ...s, [k]: !s[k] }));

  const submit = async () => {
    if (submitting) return;
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
    setSubmitting(true);
    try {
      await changeMyPassword({ currentPassword: vals.current, newPassword: vals.next });
      setMsg({ type: "success", text: "Password updated successfully!" });
      setTimeout(onClose, 1300);
    } catch (err) {
      setMsg({ type: "error", text: err?.message || "Couldn't update your password. Please try again." });
    } finally {
      setSubmitting(false);
    }
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
          <button className="pf-mb-cancel" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="pf-mb-update" onClick={submit} disabled={submitting}>{submitting ? "Updating..." : "Update Password"}</button>
        </div>
      </div>
    </div>
  );
}