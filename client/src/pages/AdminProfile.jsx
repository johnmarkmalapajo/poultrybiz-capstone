import { useState, useRef, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import {
  FiBell, FiCalendar, FiCamera, FiMail, FiPhone, FiUser, FiClock, FiMapPin,
  FiLock, FiEye, FiEyeOff, FiSave, FiX, FiCheckCircle, FiSettings, FiImage,
} from "react-icons/fi";
import "./Profile.css";
import { useUser } from "../hooks/useUser";
import { updateStoredUser } from "../hooks/useUser";
import {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  uploadAvatar,
  uploadFarmLogo,
} from "../api/profile";

const EMPTY_ADMIN = {
  fullName: "", email: "", phone: "", address: "", avatar: "",
  dateJoined: "", status: "Active", role: "Owner", position: "", employmentStatus: "", lastLogin: "",
  language: "English", timezone: "(GMT+08:00) Asia/Manila",
  emailNotif: true, loginAlerts: true,
  farmName: "", farmLocation: "", farmLogo: "", farmContact: "", farmEmail: "",
};

const STATUS_STYLE = {
  "Active":   { bg: "#eaf7f1", color: "#2e9e6b" },
  "Inactive": { bg: "#f0efec", color: "#7a7469" },
};


export default function AdminProfile({ embedded = false, onBack }) {
  const { isOwner } = useUser();
  const [saved, setSaved] = useState(EMPTY_ADMIN);
  const [form, setForm] = useState(EMPTY_ADMIN);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [pendingLogoFile, setPendingLogoFile] = useState(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState("");
  const [showPass, setShowPass] = useState(false);
  const fileRef = useRef(null);
  const logoFileRef = useRef(null);
  const toastRef = useRef(null);
  useEffect(() => () => clearTimeout(toastRef.current), []);

  useEffect(() => {
    setLoading(true);
    getMyProfile()
      .then((data) => {
        const p = { ...EMPTY_ADMIN, ...(data.record || data.data || data) };
        setSaved(p);
        setForm(p);
      })
      .catch((err) => setError(err?.message || "Couldn't load your profile."))
      .finally(() => setLoading(false));
  }, []);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
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

  const flash = (m) => { setToast(m); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(""), 3000); };

const onPickLogo = (e) => {
  const file = e.target.files?.[0];

  if (!file) return;

  if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);

  setPendingLogoFile(file);
  setPendingLogoPreview(URL.createObjectURL(file));
};

  const onSave = async () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      return flash("Full Name and Email are required.");
    }
    setSaving(true); setError("");
    try {
      let farmLogo = form.farmLogo;
      if (pendingLogoFile) {
        const result = await uploadFarmLogo(pendingLogoFile);
        farmLogo = result.farmLogo;
      }
      const payload = {
        fullName: form.fullName, email: form.email, phone: form.phone, address: form.address,
        avatar: form.avatar, language: form.language, timezone: form.timezone,
        emailNotif: form.emailNotif, loginAlerts: form.loginAlerts,
        farmName: form.farmName, farmLocation: form.farmLocation,
        farmContact: form.farmContact, farmEmail: form.farmEmail,
      };
      const updated = await updateMyProfile(payload);
      const p = { ...form, ...(updated?.record || updated?.data || updated || {}), farmLogo };
      if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);
      setPendingLogoFile(null);
      setPendingLogoPreview("");
      setSaved(p);
      setForm(p);
      updateStoredUser({ name: p.fullName, email: p.email, avatar: p.avatar });
      flash("Profile saved successfully.");
    } catch (err) {
      setError(err?.message || "Couldn't save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  const onCancel = () => {
    if (pendingLogoPreview) URL.revokeObjectURL(pendingLogoPreview);
    setPendingLogoFile(null);
    setPendingLogoPreview("");
    setForm(saved);
  };

  const st = STATUS_STYLE[form.employmentStatus] || STATUS_STYLE["Active"];
  const joinedLabel = (() => { const d = new Date(form.dateJoined); return isNaN(d) ? form.dateJoined : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); })();
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className={embedded ? "pf-embedded" : "pf-page"}>
      {!embedded && <Sidebar />}

      <div className="pf-main">

        {error && <div className="pb-error-banner">{error}</div>}
        {loading && <p className="pb-loading-text">Loading your profile...</p>}

        <div className="pf-layout">
          {}
          <div className="pf-card pf-side">
            <div className="pf-avatar-wrap">
              <div className="pf-avatar">{form.avatar ? 
                <img src={
                  form.avatar?.startsWith("http")
                  ? form.avatar
                  : `http://localhost:5000${form.avatar}`
                }
                alt="Profile"
              /> 
              : <FiUser />
              }
              </div>
              <button className="pf-cam" onClick={() => fileRef.current?.click()} aria-label="Change photo"><FiCamera /></button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
            </div>
            <h3 className="pf-name">{form.fullName || "—"}</h3>
            <p className="pf-pos">{form.position || "—"}</p>
            <div className="pf-divider" />
            <div className="pf-info-list">
              <div className="pf-info-row"><FiMail />{form.email || "—"}</div>
              <div className="pf-info-row"><FiPhone />{form.phone || "—"}</div>
              <div className="pf-info-row"><FiCalendar />Joined: {joinedLabel}</div>
              <div className="pf-info-row"><FiUser />Position: {form.position || "—"}</div>
              <div className="pf-info-row"><FiClock />Last Login: {saved.lastLogin}</div>
            </div>
            <button className="pf-changepass" onClick={() => setShowPass(true)}><FiLock /> Change Password</button>
          </div>

          {}
          <div className="pf-right">
            {}
            <div className="pf-card pf-section">
              <div className="pf-section-head"><div className="pf-section-ico"><FiUser /></div><h2>Personal Information</h2></div>
              <div className="pf-grid">
                <div className="pf-field">
                  <label className="pf-label">Full Name<span className="req">*</span></label>
                  <input className="pf-input" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Email Address<span className="req">*</span></label>
                  <input className="pf-input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Phone Number</label>
                  <input className="pf-input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Position</label>
                  <input className="pf-input readonly" value={form.position || "—"} readOnly tabIndex={-1} />
                </div>
                <div className="pf-field full">
                  <label className="pf-label">Address</label>
                  <input className="pf-input" value={form.address} onChange={(e) => set("address", e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Date Joined</label>
                  <input
                    className="pf-input readonly"
                    type="date"
                    value={form.dateJoined}
                    readOnly
                    disabled
                    tabIndex={-1}
                  />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Employment Status</label>
                  <span className="pf-status-pill" style={{ background: st.bg, color: st.color }}>
                    {st.dot} {form.employmentStatus || "—"}
                  </span>
                </div>
                <div className="pf-field">
                  <label className="pf-label">Last Login</label>
                  <input className="pf-input readonly" value={saved.lastLogin || "—"} readOnly tabIndex={-1} />
                </div>
              </div>
            </div>

            {}
            <div className="pf-card pf-section">
              <div className="pf-section-head"><div className="pf-section-ico"><FiSettings /></div><h2>Account Preferences</h2></div>
              <div className="pf-grid">
                <div className="pf-field">
                  <label className="pf-label">Language</label>
                  <select className="pf-select" value={form.language} onChange={(e) => set("language", e.target.value)}>
                    <option>English</option><option>Filipino</option>
                  </select>
                </div>
                <div className="pf-field">
                  <label className="pf-label">Time Zone</label>
                  <select className="pf-select" value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
                    <option>(GMT+08:00) Asia/Manila</option><option>(GMT+00:00) UTC</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div className="pf-pref-row">
                  <div className="pf-pref-text"><h4>Email Notifications</h4><p>Receive system updates and notifications via email.</p></div>
                  <button className={`pf-switch ${form.emailNotif ? "on" : ""}`} onClick={() => set("emailNotif", !form.emailNotif)} aria-label="Toggle email notifications" />
                </div>
                <div className="pf-pref-row">
                  <div className="pf-pref-text"><h4>Login Alerts</h4><p>Get notified when a new device logs in to your account.</p></div>
                  <button className={`pf-switch ${form.loginAlerts ? "on" : ""}`} onClick={() => set("loginAlerts", !form.loginAlerts)} aria-label="Toggle login alerts" />
                </div>
              </div>
            </div>

            {}
            {isOwner && (
              <div className="pf-card pf-section">
                <div className="pf-section-head"><div className="pf-section-ico"><FiImage /></div><h2>Farm Information</h2></div>
                <p style={{ fontSize: 12.5, color: "#8a8478", margin: "-8px 0 14px" }}>
                  Shown on exported reports (PDF headers) across the system.
                </p>
                <div className="pf-grid">
                  <div className="pf-field">
                    <label className="pf-label">Farm Name</label>
                    <input className="pf-input" value={form.farmName} onChange={(e) => set("farmName", e.target.value)} placeholder="e.g. DMDC Farm" />
                  </div>
                  <div className="pf-field">
                    <label className="pf-label">Farm Location</label>
                    <input className="pf-input" value={form.farmLocation} onChange={(e) => set("farmLocation", e.target.value)} placeholder="e.g. Poras, Boac, Marinduque" />
                  </div>
                  <div className="pf-field">
                    <label className="pf-label">Farm Contact Number</label>
                    <input className="pf-input" value={form.farmContact} onChange={(e) => set("farmContact", e.target.value)} placeholder="e.g. 0917-123-4567" />
                  </div>
                  <div className="pf-field">
                    <label className="pf-label">Farm Email <span style={{ fontWeight: 400, color: "#a39e94" }}>(optional)</span></label>
                    <input className="pf-input" type="email" value={form.farmEmail} onChange={(e) => set("farmEmail", e.target.value)} placeholder="e.g. contact@dmdcfarm.com" />
                  </div>
                  <div className="pf-field full">
                    <label className="pf-label">Farm Logo</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 64, height: 64, borderRadius: 10, border: "1px solid #e4e0d8", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#faf8f3", flexShrink: 0 }}>
                        {pendingLogoPreview || form.farmLogo ? (
                          <img
                            src={pendingLogoPreview || (form.farmLogo?.startsWith("http") ? form.farmLogo : `http://localhost:5000${form.farmLogo}`)}
                            alt="Farm logo"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : <FiImage style={{ color: "#c9c2b3" }} />}
                      </div>
                      <div>
                        <button type="button" className="pf-btn pf-btn-cancel" onClick={() => logoFileRef.current?.click()} disabled={saving}>
                          <FiCamera /> {pendingLogoPreview || form.farmLogo ? "Change Logo" : "Upload Logo"}
                        </button>
                        <input ref={logoFileRef} type="file" accept="image/*" hidden onChange={onPickLogo} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pf-actions">
          <button className="pf-btn pf-btn-cancel" onClick={onCancel} disabled={!dirty || saving}>Cancel</button>
          <button className="pf-btn pf-btn-save" onClick={onSave} disabled={!dirty || saving}><FiSave /> {saving ? "Saving..." : "Save Changes"}</button>
        </div>
      </div>

      {toast && <div className="pf-toast"><FiCheckCircle /> {toast}</div>}
      {showPass && <ChangePasswordModal onClose={() => setShowPass(false)} />}
    </div>
  );
}

function ChangePasswordModal({ onClose }) {
  const [vals, setVals] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [msg, setMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const set = (k, v) => setVals((s) => ({ ...s, [k]: v }));
  const toggle = (k) => setShow((s) => ({ ...s, [k]: !s[k] }));
  const fields = [
    { label: "Current Password", k: "current", placeholder: "Enter current password" },
    { label: "New Password", k: "next", placeholder: "Enter new password" },
    { label: "Confirm New Password", k: "confirm", placeholder: "Re-enter new password" },
  ];
  const submit = async () => {
    if (submitting) return;
    if (!vals.current || !vals.next || !vals.confirm) return setMsg({ type: "error", text: "Please fill in all password fields." });
    if (vals.next.length < 8) return setMsg({ type: "error", text: "New password must be at least 8 characters." });
    if (vals.next === vals.current) return setMsg({ type: "error", text: "New password must be different from the current one." });
    if (vals.next !== vals.confirm) return setMsg({ type: "error", text: "New password and confirmation do not match." });
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
  return (
    <div className="pf-overlay" onClick={onClose}>
      <div className="pf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pf-modal-head"><h3>Change Password</h3><button onClick={onClose} aria-label="Close"><FiX /></button></div>
        <p className="pf-modal-sub">Use at least 8 characters. Keep your account secure.</p>
        {msg && <div className={`pf-msg ${msg.type}`}>{msg.type === "success" ? <FiCheckCircle /> : <FiX />} {msg.text}</div>}
        {fields.map((f) => (
          <div className="pf-pass-field" key={f.k}>
            <label>{f.label}</label>
            <div className="pf-pass-input">
              <input type={show[f.k] ? "text" : "password"} value={vals[f.k]} onChange={(e) => set(f.k, e.target.value)} placeholder={f.placeholder} />
              <button className="pf-eye" onClick={() => toggle(f.k)} aria-label="Toggle visibility" tabIndex={-1}>{show[f.k] ? <FiEyeOff /> : <FiEye />}</button>
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