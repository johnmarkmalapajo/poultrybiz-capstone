import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiUser, FiBriefcase, FiFileText, FiSave, FiLock, FiX } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditPersonnel.css";
import { getPersonnel, updatePersonnel } from "../api/personnelManpower";
import { useUser } from "../hooks/useUser";

const STATUS_OPTIONS = ["Active", "Inactive"];
const SHIFT_OPTIONS = [
  "Morning (6:00 AM - 2:00 PM)",
  "Afternoon (2:00 PM - 10:00 PM)",
  "Evening (10:00 PM - 6:00 AM)",
];

const prof = (r) => (r ? r.profile || r.myProfile || r.user || r : {});
const getName = (r) => {
  const p = prof(r);
  return p.fullName || p.name || [p.firstName, p.lastName].filter(Boolean).join(" ") || "";
};
const getContact = (r) => {
  const p = prof(r);
  return p.contactNumber || p.contact || p.phone || p.mobile || p.phoneNumber || "";
};
const getEmail = (r) => {
  const p = prof(r);
  return (
    p.email ||
    p.emailAddress ||
    r?.email ||
    r?.emailAddress ||
    r?.user?.email ||
    ""
  );
};
const getImage = (r) => {
  const p = prof(r);

  const avatar =
    p.avatar ||
    p.profilePicture ||
    p.profileImage ||
    p.image ||
    p.photo;

  if (!avatar) return "";

  return avatar.startsWith("http")
    ? avatar
    : `http://localhost:5000${avatar}`;
};
const getInitials = (name) =>
  (name ? name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") : "?").toUpperCase();
const getAccountRole = (r) => r?.accountRole || r?.userRole || r?.userType || r?.role || r?.user?.role || r?.profile?.role || "";

export default function EditPersonnel() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isOwner } = useUser();

  const [profileInfo, setProfileInfo] = useState({ fullName: "", contactNumber: "", email: "", image: "" });
  const [saving, setSaving] = useState(false);
  const [accountRole, setAccountRole] = useState("");
  const isTargetOwner = /^owner$/i.test(accountRole);
  const accessDenied = !isOwner;
  const canEditPosition = isOwner && !isTargetOwner;

  const [formData, setFormData] = useState({
    position: "",
    shiftHours: "",
    status: "Active",
    dateHired: "",
    remarks: "",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const breadcrumbItems = [
    { label: "PERSONNEL AND VISITORS", path: "/personnel-visitors" },
    { label: "PERSONNEL AND MANPOWER", path: "/personnel-visitors/personnel" },
    { label: "VIEW PERSONNEL", path: `/personnel-visitors/personnel/view/${id}` },
    { label: "EDIT PERSONNEL" },
  ];

  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      setError("");
      const apply = (rec) => {
        if (!rec) return;
        const role = getAccountRole(rec);
        setAccountRole(role);
        const pInfo = {
          fullName: getName(rec),
          contactNumber: getContact(rec),
          email:  getEmail(rec),
          image: getImage(rec),
        };
        setProfileInfo(pInfo);
        setFormData((prev) => ({
          ...prev,
          position: rec.position || rec.jobTitle || "",
          shiftHours: rec.shiftHours || rec.shift || rec.dutyHours || "",
          status: rec.status || "Active",
          dateHired: rec.dateHired ? String(rec.dateHired).slice(0, 10) : "",
          remarks: rec.remarks || rec.notes || "",
        }));
      };

      try {
        const json = await getPersonnel(id);
        const rec = json.record || json.data || json;
        if (rec && (rec._id || rec.profile || rec.position)) {
          apply(rec);
        } else {
          setError("Record not found.");
        }
      } catch (err) {
        setError(err?.message || "Couldn't load this record.");
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const payload = isTargetOwner ? { position: formData.position } : { ...formData };
    if (!canEditPosition) delete payload.position;
    if (!isOwner) delete payload.status;
    if (window.__pbSaving) return;
    window.__pbSaving = true;
    setSaving(true); setError("");
    try {
      await updatePersonnel(id, payload);
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { }
      navigate(`/personnel-visitors/personnel/view/${id}`);
    } catch (err) {
      setError(err?.message || "Couldn't save changes. Please try again.");
      setSaving(false);
    } finally {
      window.__pbSaving = false;
    }
  };

  if (loading) {
    return (
      <PageLayout background="#f4f4f2" breadcrumbItems={breadcrumbItems}>
        <p className="ep-loading">Loading personnel record...</p>
      </PageLayout>
    );
  }

  if (accessDenied) {
    return (
      <PageLayout background="#f4f4f2" breadcrumbItems={breadcrumbItems}>
        <div className="pb-error-banner">
          Only the Owner can edit this record.
        </div>
        <button type="button" className="ep-cancel-btn" onClick={() => navigate(`/personnel-visitors/personnel/view/${id}`)}>
          <FiX /> Back
        </button>
      </PageLayout>
    );
  }

  return (
    <PageLayout background="#f4f4f2" breadcrumbItems={breadcrumbItems}>
        <form className="ep-form-card" onSubmit={handleSubmit}>

          {error && (
            <div className="pb-error-banner">
              {error}
            </div>
          )}

          <div className="ep-section-header">
            <FiUser />
            <h3>Profile Information</h3>
            <div className="ep-line" />
          </div>

          <div className="ep-profile-row">
            {profileInfo.image ? (
              <img className="ep-avatar" src={profileInfo.image} alt="" />
            ) : (
              <span className="ep-avatar ep-avatar-fallback">{getInitials(profileInfo.fullName)}</span>
            )}
            <p className="ep-avatar-note">
              <FiLock style={{ verticalAlign: "middle", marginRight: 6 }} />
              Profile Picture is synced from the account's My Profile and is read-only.
            </p>
          </div>

          <div className="ep-form-grid">
            <div className="ep-form-group ep-locked">
              <label>Full Name <span className="ep-lock-badge">Synced</span></label>
              <input type="text" value={profileInfo.fullName} disabled readOnly />
              <small>Synced from My Profile</small>
            </div>

            <div className="ep-form-group ep-locked">
              <label>Contact Number <span className="ep-lock-badge">Synced</span></label>
              <input type="text" value={profileInfo.contactNumber} disabled readOnly />
              <small>Synced from My Profile</small>
            </div>

            <div className="ep-form-group ep-locked">
              <label>Email Address <span className="ep-lock-badge">Synced</span></label>
              <input type="text" value={profileInfo.email} disabled readOnly />
              <small>Synced from My Profile</small>
            </div>
          </div>

          <div className="ep-section-header">
            <FiBriefcase />
            <h3>{isTargetOwner ? "Role" : "Employment Details"}</h3>
            <div className="ep-line" />
          </div>

          <div className="ep-form-grid">
            <div className="ep-form-group">
              <label>
                Position / Role <span className="ep-req">*</span>
                {!canEditPosition && <span className="ep-lock-badge">{isTargetOwner ? "Fixed" : "Owner only"}</span>}
              </label>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleChange}
                placeholder="e.g., Poultry Technician"
                required
                disabled={!canEditPosition}
                readOnly={!canEditPosition}
              />
              {!canEditPosition && (
                <small>
                  {isTargetOwner
                    ? "The Owner's position is permanently fixed."
                    : "Only the Owner can set or change a position."}
                </small>
              )}
            </div>

            {!isTargetOwner && (
              <>
                <div className="ep-form-group">
                  <label>Shift / Duty Hours <span className="ep-req">*</span></label>
                  <input
                    type="text"
                    name="shiftHours"
                    value={formData.shiftHours}
                    onChange={handleChange}
                    list="shift-options"
                    placeholder="e.g., 6:00 AM - 3:00 PM"
                    required
                  />
                  <datalist id="shift-options">
                    {SHIFT_OPTIONS.map((s) => <option key={s} value={s} />)}
                  </datalist>
                  <small>Type custom hours or pick a standard shift</small>
                </div>

                <div className="ep-form-group">
                  <label>
                    Employment Status <span className="ep-req">*</span>
                    {!isOwner && <span className="ep-lock-badge">Owner only</span>}
                  </label>
                  <select name="status" value={formData.status} onChange={handleChange} required disabled={!isOwner}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {!isOwner && <small>Only the Owner can change employment status here.</small>}
                </div>

                <div className="ep-form-group">
                  <label>Date Hired</label>
                  <input type="date" name="dateHired" value={formData.dateHired} onChange={handleChange} />
                </div>
              </>
            )}
          </div>

          {!isTargetOwner && (
            <>
              <div className="ep-section-header">
                <FiFileText />
                <h3>Assignment &amp; Notes</h3>
                <div className="ep-line" />
              </div>

              <div className="ep-form-group ep-full-width">
                <label>Remarks <span style={{ color: "#a39e94", fontWeight: 400 }}>(optional)</span></label>
                <textarea
                  rows="5"
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleChange}
                  placeholder="Enter remarks, observations, or additional information..."
                />
              </div>
            </>
          )}

          <div className="ep-form-actions">
            <p className="ep-req-note">Fields with * are required.</p>
            <div className="ep-action-btns">
              <button type="button" className="ep-cancel-btn" onClick={() => navigate(`/personnel-visitors/personnel/view/${id}`)} disabled={saving}>
                <FiX /> Cancel
              </button>
              <button type="submit" disabled={saving} className="ep-save-btn">
                <FiSave /> {saving ? "Saving..." : "Update Record"}
              </button>
            </div>
          </div>
        </form>
    </PageLayout>
  );
}