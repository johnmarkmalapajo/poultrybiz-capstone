import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiClipboard, FiCalendar, FiFlag, FiFileText, FiSave, FiMenu } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./AddTask.css";

/* ── To Do store (inline · localStorage · same keys as the To Do pages) ── */
const K_ASSIGNED = "pb_assigned_tasks";
const K_NOTIFS = "pb_notifications";
const _read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch { return {}; } };
const _write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
const _uid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const getCurrentUser = (fallback = null) => {
  for (const key of ["pb_user", "user", "currentUser", "authUser"]) {
    try {
      const raw = localStorage.getItem(key); if (!raw) continue;
      const u = JSON.parse(raw);
      const name = u.fullName || u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username;
      const id = u._id || u.id || u.userId || name;
      if (name || id) return { id, name: name || "User" };
    } catch (e) { /* ignore */ }
  }
  return fallback;
};
const assignTask = (farmerId, task, assignedBy = "Admin") => {
  const all = _read(K_ASSIGNED);
  const t = { _id: _uid("at"), title: task.title || "Untitled task", description: task.description || "", dueDate: task.dueDate || "", priority: task.priority || "Medium", status: "Pending", completedAt: null, assignedBy, createdAt: new Date().toISOString() };
  all[farmerId] = [t, ...(all[farmerId] || [])];
  _write(K_ASSIGNED, all);
  const notifs = _read(K_NOTIFS);
  notifs[farmerId] = [{ _id: _uid("n"), message: `New task assigned: ${t.title}${t.dueDate ? ` (due ${t.dueDate})` : ""}.`, read: false, at: new Date().toISOString() }, ...(notifs[farmerId] || [])];
  _write(K_NOTIFS, notifs);
  return t;
};
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

const PRIORITIES = ["High", "Medium", "Low"];
const STATUSES = ["Pending", "In Progress", "Completed"];

const fullName = (p) =>
  p?.profile?.fullName || p?.fullName || p?.name || "this personnel";
const initials = (name) =>
  (name ? name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") : "?").toUpperCase();
const today = () => new Date().toISOString().slice(0, 10);

export default function AddTask() {
  const navigate = useNavigate();
  const { id } = useParams(); // personnel id

  const person = getPersonnelById(id);
  const personName = fullName(person);

  const [formData, setFormData] = useState({
    work: "",
    assignedDate: today(),
    dueDate: "",
    priority: "Medium",
    status: "Pending",
    notes: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...formData, personnelId: id, assignedTo: personName };
    console.log("New Task:", payload);
    // Push the assigned task into the farmer's To Do (frontend simulation) +
    // notify the farmer. Backend should persist this and sync across users.
    assignTask(
      id,
      {
        title: formData.work,
        description: formData.notes,
        dueDate: formData.dueDate,
        priority: formData.priority,
      },
      getCurrentUser({ name: "Engr. Maria Egginear" }).name
    );
    navigate(`/personnel-visitors/personnel/view/${id}`);
  };

  return (
    <div className="add-task-page">
      <Sidebar />

      <div className="add-task-main">

        {/* Breadcrumb */}
        <div className="add-task-breadcrumb">
          <button className="add-task-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="breadcrumb-link" onClick={() => navigate("/personnel-visitors/personnel")}>PERSONNEL RECORDS</span>
          <span>›</span>
          <span className="breadcrumb-link" onClick={() => navigate(`/personnel-visitors/personnel/view/${id}`)}>VIEW PERSONNEL</span>
          <span>›</span>
          <span className="breadcrumb-current">ADD TASK</span>
        </div>

        {/* Header */}
        <div className="add-task-header">
          <div>
            <h2>Add Task</h2>
            <p>Assign a new task to this personnel. The task will appear in their Tasks tab.</p>
          </div>
        </div>

        <form className="task-form-card" onSubmit={handleSubmit}>

          {/* Who the task is for (read-only) */}
          <div className="task-for-banner">
            <span className="tfb-avatar">{initials(personName)}</span>
            <div>
              <div className="tfb-label">Assigning task to</div>
              <div className="tfb-name">{personName}</div>
            </div>
          </div>

          {/* TASK DETAILS */}
          <div className="section-header">
            <FiClipboard />
            <h3>TASK DETAILS</h3>
            <div className="line"></div>
          </div>

          <div className="form-group full-width">
            <label>Work Assigned <span className="req">*</span></label>
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
          <div className="section-header">
            <FiCalendar />
            <h3>SCHEDULE</h3>
            <div className="line"></div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Assigned Date <span className="req">*</span></label>
              <input type="date" name="assignedDate" value={formData.assignedDate} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label>Due Date <span className="req">*</span></label>
              <input type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} required />
            </div>
          </div>

          {/* PRIORITY & STATUS */}
          <div className="section-header">
            <FiFlag />
            <h3>PRIORITY & STATUS</h3>
            <div className="line"></div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Priority <span className="req">*</span></label>
              <select name="priority" value={formData.priority} onChange={handleChange} required>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Status <span className="req">*</span></label>
              <select name="status" value={formData.status} onChange={handleChange} required>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* NOTES */}
          <div className="section-header">
            <FiFileText />
            <h3>ADDITIONAL NOTES</h3>
            <div className="line"></div>
          </div>

          <div className="form-group full-width">
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
          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={() => navigate(`/personnel-visitors/personnel/view/${id}`)}>
              Cancel
            </button>
            <button type="submit" className="save-btn">
              <FiSave /> Save Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}