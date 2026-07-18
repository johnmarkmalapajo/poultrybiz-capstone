import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiClipboard, FiCalendar, FiFlag, FiFileText, FiSave, FiX } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditTask.css";
import { updateAssignedTask } from "../todoStore";
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

const TASKS_BY_ID = {
  f1: [
    { _id: "t1", date: "May 1, 2024", work: "Morning feeding (Cage 1-4)", assignedDate: "Apr 30, 2024", dueDate: "May 1, 2024", priority: "High",   status: "Completed" },
    { _id: "t2", date: "May 2, 2024", work: "Egg collection + sorting",   assignedDate: "May 1, 2024",  dueDate: "May 2, 2024", priority: "Medium", status: "In Progress" },
    { _id: "t3", date: "May 3, 2024", work: "Cage cleaning",              assignedDate: "May 2, 2024",  dueDate: "May 4, 2024", priority: "Low",    status: "Pending" },
  ],
  f2: [
    { _id: "t1", date: "May 1, 2024", work: "Vaccination (Flock B-002)",  assignedDate: "Apr 29, 2024", dueDate: "May 1, 2024", priority: "High",   status: "Completed" },
    { _id: "t2", date: "May 3, 2024", work: "Health check round",         assignedDate: "May 2, 2024",  dueDate: "May 3, 2024", priority: "Medium", status: "Pending" },
  ],
  f3: [
    { _id: "t1", date: "May 1, 2024", work: "Water line inspection",      assignedDate: "Apr 30, 2024", dueDate: "May 2, 2024", priority: "Medium", status: "In Progress" },
  ],
  f4: [],
  f5: [],
  f6: [],
};

const getPersonnelById = (id) => PERSONNEL.find((p) => p._id === id) || null;
const getTaskById = (personId, taskId) =>
  (TASKS_BY_ID[personId] || []).find((t) => t._id === taskId) || null;

const PRIORITIES = ["High", "Medium", "Low"];
const STATUSES = ["Pending", "In Progress", "Completed"];

const fullName = (p) =>
  p?.profile?.fullName || p?.fullName || p?.name || "this personnel";
const initials = (name) =>
  (name ? name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") : "?").toUpperCase();
const toDateInput = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
};

export default function EditTask() {
  const navigate = useNavigate();
  const { id, taskId } = useParams(); // personnel id + task id

  const person = getPersonnelById(id);
  const personName = fullName(person);

  const [formData, setFormData] = useState({
    work: "",
    assignedDate: "",
    dueDate: "",
    priority: "Medium",
    status: "Pending",
    notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = getTaskById(id, taskId);
    if (t) {
      setFormData({
        work: t.work || t.task || "",
        assignedDate: toDateInput(t.assignedDate) || t.assignedDate || "",
        dueDate: toDateInput(t.dueDate) || t.dueDate || "",
        priority: t.priority || "Medium",
        status: t.status || "Pending",
        notes: t.notes || "",
      });
    }
    setLoading(false);
  }, [id, taskId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (saving) return;
    if (window.__pbSaving) return;  // prevent duplicate submissions
    window.__pbSaving = true;
    setSaving(true);

    const payload = { ...formData, _id: taskId, personnelId: id, assignedTo: personName };
    updateAssignedTask(id, taskId, payload);

    window.__pbSaving = false;
    navigate(`/personnel-visitors/personnel/view/${id}`);
  };

  if (loading) {
    return (
      <PageLayout
        background="#f4f4f2"
        breadcrumbItems={[
          { label: "PERSONNEL AND MANPOWER", path: "/personnel-visitors/personnel" },
          { label: "VIEW PERSONNEL", path: `/personnel-visitors/personnel/view/${id}` },
          { label: "EDIT TASK" },
        ]}
      >
        <p className="et-loading">Loading task...</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        { label: "PERSONNEL RECORDS", path: "/personnel-visitors/personnel" },
        { label: "VIEW PERSONNEL", path: `/personnel-visitors/personnel/view/${id}` },
        { label: "EDIT TASK" },
      ]}
    >
        <form className="et-form-card" onSubmit={handleSubmit}>

          {/* Who the task is for (read-only) */}
          <div className="et-for-banner">
            <span className="et-tfb-avatar">{initials(personName)}</span>
            <div>
              <div className="et-tfb-label">Task assigned to</div>
              <div className="et-tfb-name">{personName}</div>
            </div>
          </div>

          {/* TASK DETAILS */}
          <div className="et-section-header">
            <FiClipboard />
            <h3>Task Details</h3>
            <div className="et-line" />
          </div>

          <div className="et-form-group et-full-width">
            <label>Work Assigned <span className="et-req">*</span></label>
            <input
              type="text"
              name="work"
              value={formData.work}
              onChange={handleChange}
              placeholder="e.g., Morning feeding (Cage 1-4)"
              required
            />
          </div>

          {/* SCHEDULE */}
          <div className="et-section-header">
            <FiCalendar />
            <h3>Schedule</h3>
            <div className="et-line" />
          </div>

          <div className="et-form-grid">
            <div className="et-form-group">
              <label>Assigned Date <span className="et-req">*</span></label>
              <input type="date" name="assignedDate" value={formData.assignedDate} onChange={handleChange} required />
            </div>

            <div className="et-form-group">
              <label>Due Date <span className="et-req">*</span></label>
              <input type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} required />
            </div>
          </div>

          {/* PRIORITY & STATUS */}
          <div className="et-section-header">
            <FiFlag />
            <h3>Priority &amp; Status</h3>
            <div className="et-line" />
          </div>

          <div className="et-form-grid">
            <div className="et-form-group">
              <label>Priority <span className="et-req">*</span></label>
              <select name="priority" value={formData.priority} onChange={handleChange} required>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="et-form-group">
              <label>Status <span className="et-req">*</span></label>
              <select name="status" value={formData.status} onChange={handleChange} required>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* NOTES */}
          <div className="et-section-header">
            <FiFileText />
            <h3>Additional Notes</h3>
            <div className="et-line" />
          </div>

          <div className="et-form-group et-full-width">
            <label>Notes <span style={{ color: "#a39e94", fontWeight: 400 }}>(optional)</span></label>
            <textarea
              rows="4"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Extra instructions or details..."
            />
          </div>

          {/* Actions */}
          <div className="et-form-actions">
            <p className="et-req-note">Fields with * are required.</p>
            <div className="et-action-btns">
              <button type="button" className="et-cancel-btn" onClick={() => navigate(`/personnel-visitors/personnel/view/${id}`)} disabled={saving}>
                <FiX /> Cancel
              </button>
              <button type="submit" className="et-save-btn" disabled={saving}>
                <FiSave /> {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
    </PageLayout>
  );
}