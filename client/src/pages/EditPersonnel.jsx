import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiUser, FiBriefcase, FiFileText, FiSave, FiLock, FiX } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { getFarmerProfile } from "./FarmerProfile";
import "./EditPersonnel.css";
// ── Inline mock data (frontend fallback until the API is wired) ──
// Same records/IDs as Personnelandmanpower.jsx and ViewPersonnel.jsx so a
// "View"/"Edit" click on any listed row always resolves to a matching record.
const PERSONNEL = [
  {
    _id: "pm_seed_1", accountRole: "Admin", status: "Active",
    position: "Admin", shiftHours: "—", dateHired: "—",
    assignedWork: "", remarks: "",
    profile: { fullName: "Ramon Cruz", contactNumber: "0917 555 1201", image: "" },
  },
  {
    _id: "pm_seed_2", accountRole: "Owner", status: "Active",
    position: "Owner", shiftHours: "—", dateHired: "—",
    assignedWork: "", remarks: "",
    profile: { fullName: "Helen Yu", contactNumber: "0935 555 7788", image: "" },
  },
  {
    _id: "pm_seed_3", accountRole: "Farmer", position: "Layer House Attendant",
    dateHired: "2025-12-14", shiftHours: "6:00 AM – 2:00 PM", status: "Active",
    assignedWork: "Handles daily egg collection", remarks: "Handles daily egg collection",
    profile: { fullName: "Liza Mendoza", contactNumber: "0928 555 3345", image: "" },
  },
  {
    _id: "pm_seed_4", accountRole: "Farmer", position: "Feed & Inventory Handler",
    dateHired: "2026-01-08", shiftHours: "7:00 AM – 3:00 PM", status: "Active",
    assignedWork: "In charge of feed stock rotation", remarks: "In charge of feed stock rotation",
    profile: { fullName: "Paolo Lim", contactNumber: "0939 555 8890", image: "" },
  },
  {
    _id: "pm_seed_5", accountRole: "Farmer", position: "General Farm Worker",
    dateHired: "2026-02-11", shiftHours: "6:00 AM – 2:00 PM", status: "Active",
    assignedWork: "", remarks: "—",
    profile: { fullName: "Noel Aguilar", contactNumber: "0926 555 2201", image: "" },
  },
  {
    _id: "pm_seed_6", accountRole: "Farmer", position: "Sanitation & Waste Management",
    dateHired: "2025-09-19", shiftHours: "2:00 PM – 10:00 PM", status: "Inactive",
    assignedWork: "", remarks: "On extended leave",
    profile: { fullName: "Grace Fabella", contactNumber: "0917 555 6610", image: "" },
  },
  {
    _id: "pm_seed_7", accountRole: "Farmer", position: "Layer House Attendant",
    dateHired: "2026-03-22", shiftHours: "6:00 AM – 2:00 PM", status: "On Leave",
    assignedWork: "", remarks: "Approved leave until end of month",
    profile: { fullName: "Mateo Santos", contactNumber: "0905 555 4412", image: "" },
  },
];

const getPersonnelById = (id) => PERSONNEL.find((p) => p._id === id) || null;

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/personnel`;
const STATUS_OPTIONS = ["Active", "Inactive", "On Leave"];
const SHIFT_OPTIONS = [
  "Morning (6:00 AM - 2:00 PM)",
  "Afternoon (2:00 PM - 10:00 PM)",
  "Evening (10:00 PM - 6:00 AM)",
];

// My Profile accessors (read-only fields)
const prof = (r) => (r ? r.profile || r.myProfile || r.user || r : {});
const getName = (r) => {
  const p = prof(r);
  return p.fullName || p.name || [p.firstName, p.lastName].filter(Boolean).join(" ") || "";
};
const getContact = (r) => {
  const p = prof(r);
  return p.contactNumber || p.contact || p.phone || p.mobile || p.phoneNumber || "";
};
const getImage = (r) => {
  const p = prof(r);
  return p.image || p.photo || p.avatar || p.profilePicture || p.profileImage || "";
};
const getInitials = (name) =>
  (name ? name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") : "?").toUpperCase();
const getAccountRole = (r) => r?.accountRole || r?.userRole || r?.userType || r?.role || "";

export default function EditPersonnel() {
  const navigate = useNavigate();
  const { id } = useParams();

  // Read-only profile (synced from My Profile)
  const [profileInfo, setProfileInfo] = useState({ fullName: "", contactNumber: "", email: "", image: "" });
  const [saving, setSaving] = useState(false);
  const [accountRole, setAccountRole] = useState("");
  const isAdmin = /owner|admin/i.test(accountRole);

  // Editable personnel fields (Admin/Owner managed)
  const [formData, setFormData] = useState({
    position: "",
    shiftHours: "",
    status: "Active",
    dateHired: "",
    assignedWork: "",
    remarks: "",
  });

  const [loading, setLoading] = useState(true);

  const breadcrumbItems = [
    { label: "PERSONNEL AND VISITORS", path: "/personnel-visitors" },
    { label: "PERSONNEL RECORDS", path: "/personnel-visitors/personnel" },
    { label: "VIEW PERSONNEL", path: `/personnel-visitors/personnel/view/${id}` },
    { label: "EDIT PERSONNEL" },
  ];

  // ── Fetch this personnel record ──
  useEffect(() => {
    const mockRecord = getPersonnelById(id);
    const fetchRecord = async () => {
      const apply = (rec) => {
        if (!rec) return;
        const role = getAccountRole(rec);
        setAccountRole(role);
        let pInfo = {
          fullName: getName(rec),
          contactNumber: getContact(rec),
          email: rec.profile?.email || rec.email || "",
          image: getImage(rec),
        };
        // Farmer-managed fields come from the Farmer's My Profile (always latest, read-only here)
        if (/farmer/i.test(role)) {
          try {
            const fp = getFarmerProfile();
            if (fp) pInfo = {
              fullName: fp.fullName || pInfo.fullName,
              contactNumber: fp.phone || pInfo.contactNumber,
              email: fp.email || pInfo.email,
              image: fp.avatar || pInfo.image,
            };
          } catch { /* ignore */ }
        }
        setProfileInfo(pInfo);
        setFormData((prev) => ({
          ...prev,
          position: rec.position || rec.jobTitle || "",
          shiftHours: rec.shiftHours || rec.shift || rec.dutyHours || "",
          status: rec.status || "Active",
          dateHired: rec.dateHired ? String(rec.dateHired).slice(0, 10) : "",
          assignedWork: rec.assignedWork || rec.assignedTask || "",
          remarks: rec.remarks || rec.notes || "",
        }));
      };

      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/${id}`, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const rec = json.record || json.data || json;
        apply(rec && (rec._id || rec.profile || rec.position) ? rec : mockRecord);
      } catch {
        apply(mockRecord);
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
    // Only the editable (Admin-managed) fields are saved.
    // Full Name, Contact Number, Profile Picture stay synced from My Profile.
    const payload = isAdmin ? { position: formData.position } : { ...formData };
    console.log("Updated Personnel Data:", payload);
    // API integration later
    if (window.__pbSaving) return;  // prevent duplicate submissions
    window.__pbSaving = true;
    try {
      setSaving(true);
      await fetch(`${API_BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setSaving(false); /* saving is local (mock API) — ignore network errors */ }
    finally { window.__pbSaving = false; }

    navigate(`/personnel-visitors/personnel/view/${id}`);
  };

  if (loading) {
    return (
      <PageLayout background="#f4f4f2" breadcrumbItems={breadcrumbItems}>
        <p className="ep-loading">Loading personnel record...</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout background="#f4f4f2" breadcrumbItems={breadcrumbItems}>
        <form className="ep-form-card" onSubmit={handleSubmit}>

          {/* PROFILE INFORMATION (read-only, from My Profile) */}
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

          {/* ROLE / EMPLOYMENT (editable) */}
          <div className="ep-section-header">
            <FiBriefcase />
            <h3>{isAdmin ? "Role" : "Employment Details"}</h3>
            <div className="ep-line" />
          </div>

          <div className="ep-form-grid">
            <div className="ep-form-group">
              <label>Position / Role <span className="ep-req">*</span></label>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleChange}
                placeholder="e.g., Poultry Technician"
                required
              />
            </div>

            {!isAdmin && (
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
                  <label>Employment Status <span className="ep-req">*</span></label>
                  <select name="status" value={formData.status} onChange={handleChange} required>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="ep-form-group">
                  <label>Date Hired</label>
                  <input type="date" name="dateHired" value={formData.dateHired} onChange={handleChange} />
                </div>
              </>
            )}
          </div>

          {!isAdmin && (
            <>
              {/* ASSIGNMENT & NOTES (editable) */}
              <div className="ep-section-header">
                <FiFileText />
                <h3>Assignment &amp; Notes</h3>
                <div className="ep-line" />
              </div>

              <div className="ep-form-group ep-full-width">
                <label>Assigned Work</label>
                <input
                  type="text"
                  name="assignedWork"
                  value={formData.assignedWork}
                  onChange={handleChange}
                  placeholder="e.g., Morning feeding · Cage 1-4 cleaning"
                />
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

          {/* Actions */}
          <div className="ep-form-actions">
            <p className="ep-req-note">Fields with * are required.</p>
            <div className="ep-action-btns">
              <button type="button" className="ep-cancel-btn" onClick={() => navigate(`/personnel-visitors/personnel/view/${id}`)} disabled={saving}>
                <FiX /> Cancel
              </button>
              <button type="submit" disabled={saving} className="ep-save-btn">
                <FiSave /> {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
    </PageLayout>
  );
}