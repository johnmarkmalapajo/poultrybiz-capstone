import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiUser, FiBriefcase, FiFileText, FiSave, FiMenu, FiLock } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import { getFarmerProfile } from "./FarmerProfile";
import "./EditPersonnel.css";
// ── Inline mock data (frontend fallback until the API is wired) ──
const PERSONNEL = [
  {
    _id: "o1", accountRole: "Owner / Admin", status: "Active",
    position: "Owner / Admin", shiftHours: "—", dateHired: "—",
    assignedWork: "", remarks: "",
    profile: { fullName: "Engr. Maria Egginear", contactNumber: "0917 000 1111", image: "" },
  },
  {
    _id: "f1", accountRole: "Farmer", position: "Farm Worker",
    dateHired: "2023-01-10", shiftHours: "6:00 AM - 3:00 PM", status: "Active",
    assignedWork: "Morning feeding · Cage 1-4 cleaning", remarks: "Hardworking and trustworthy.",
    profile: { fullName: "Juan Dela Cruz", contactNumber: "0917 123 4567", image: "" },
  },
  {
    _id: "f2", accountRole: "Farmer", position: "Poultry Technician",
    dateHired: "2023-02-15", shiftHours: "7:00 AM - 4:00 PM", status: "Active",
    assignedWork: "Vaccination round (Flock B-002)", remarks: "Skilled in poultry care.",
    profile: { fullName: "Maria Santos", contactNumber: "0917 234 5678", image: "" },
  },
  {
    _id: "f3", accountRole: "Farmer", position: "Maintenance Worker",
    dateHired: "2023-03-01", shiftHours: "8:00 AM - 5:00 PM", status: "Active",
    assignedWork: "Water line + equipment check", remarks: "Handles equipment maintenance.",
    profile: { fullName: "Pedro Reyes", contactNumber: "0917 345 6789", image: "" },
  },
  {
    _id: "f4", accountRole: "Farmer", position: "Inventory Clerk",
    dateHired: "2023-03-20", shiftHours: "8:00 AM - 5:00 PM", status: "Active",
    assignedWork: "", remarks: "Organized and detail-oriented.",
    profile: { fullName: "Ana Garcia", contactNumber: "0917 456 7890", image: "" },
  },
  {
    _id: "f5", accountRole: "Farmer", position: "Farm Hand",
    dateHired: "2023-04-05", shiftHours: "6:00 AM - 3:00 PM", status: "On Leave",
    assignedWork: "", remarks: "On medical leave until further notice.",
    profile: { fullName: "Mark Villanueva", contactNumber: "0917 567 8901", image: "" },
  },
  {
    _id: "f6", accountRole: "Farmer", position: "Poultry Technician",
    dateHired: "2023-06-12", shiftHours: "7:00 AM - 4:00 PM", status: "Inactive",
    assignedWork: "", remarks: "Resigned last May 30, 2024.",
    profile: { fullName: "Grace Lagon", contactNumber: "0917 678 9012", image: "" },
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
      <div className="edit-personnel-page">
        <Sidebar />
        <div className="edit-personnel-main">
          <p className="edit-personnel-loading">Loading personnel record...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-personnel-page">
      <Sidebar />

      <div className="edit-personnel-main">

        {/* Breadcrumb */}
        <div className="edit-personnel-breadcrumb">
          <button className="edit-personnel-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="breadcrumb-link" onClick={() => navigate("/personnel-visitors")}>PERSONNEL AND VISITORS</span>
          <span>›</span>
          <span className="breadcrumb-link" onClick={() => navigate("/personnel-visitors/personnel")}>PERSONNEL RECORDS</span>
          <span>›</span>
          <span className="breadcrumb-link" onClick={() => navigate(`/personnel-visitors/personnel/view/${id}`)}>VIEW PERSONNEL</span>
          <span>›</span>
          <span className="breadcrumb-current">EDIT PERSONNEL</span>
        </div>

        {/* Header */}

        <form className="personnel-form-card" onSubmit={handleSubmit}>

          {/* PROFILE INFORMATION (read-only, from My Profile) */}
          <div className="section-header">
            <FiUser />
            <h3>PROFILE INFORMATION</h3>
            <div className="line"></div>
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

          <div className="form-grid">
            <div className="form-group ep-locked">
              <label>Full Name <span className="ep-lock-badge">Synced</span></label>
              <input type="text" value={profileInfo.fullName} disabled readOnly />
              <small>Synced from My Profile</small>
            </div>

            <div className="form-group ep-locked">
              <label>Contact Number <span className="ep-lock-badge">Synced</span></label>
              <input type="text" value={profileInfo.contactNumber} disabled readOnly />
              <small>Synced from My Profile</small>
            </div>

            <div className="form-group ep-locked">
              <label>Email Address <span className="ep-lock-badge">Synced</span></label>
              <input type="text" value={profileInfo.email} disabled readOnly />
              <small>Synced from My Profile</small>
            </div>
          </div>

          {/* ROLE / EMPLOYMENT (editable) */}
          <div className="section-header">
            <FiBriefcase />
            <h3>{isAdmin ? "ROLE" : "EMPLOYMENT DETAILS"}</h3>
            <div className="line"></div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Position / Role <span className="req">*</span></label>
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
                <div className="form-group">
                  <label>Shift / Duty Hours <span className="req">*</span></label>
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

                <div className="form-group">
                  <label>Employment Status <span className="req">*</span></label>
                  <select name="status" value={formData.status} onChange={handleChange} required>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Date Hired</label>
                  <input type="date" name="dateHired" value={formData.dateHired} onChange={handleChange} />
                </div>
              </>
            )}
          </div>

          {!isAdmin && (
            <>
              {/* ASSIGNMENT & NOTES (editable) */}
              <div className="section-header">
                <FiFileText />
                <h3>ASSIGNMENT & NOTES</h3>
                <div className="line"></div>
              </div>

              <div className="form-group full-width">
                <label>Assigned Work</label>
                <input
                  type="text"
                  name="assignedWork"
                  value={formData.assignedWork}
                  onChange={handleChange}
                  placeholder="e.g., Morning feeding · Cage 1-4 cleaning"
                />
              </div>

              <div className="form-group full-width">
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
          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={() => navigate(`/personnel-visitors/personnel/view/${id}`)}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="save-btn">
              <FiSave />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
