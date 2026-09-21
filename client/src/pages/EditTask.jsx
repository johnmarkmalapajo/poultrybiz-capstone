import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiClipboard, FiCalendar, FiFlag, FiFileText, FiSave, FiX } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditTask.css";
import {getPersonnelTask, updatePersonnelTask,} from "../api/personnelManpower";
import { getPersonnel } from "../api/personnelManpower";

const PRIORITIES = ["High", "Medium", "Low"];
const STATUSES = ["Pending", "Completed"];

const FARMER_CATEGORIES = [
  "Flock Record", "Egg Record", "Health Record", "Quarantine and Isolation",
  "Manure and Waste Record", "Mortality Record", "Feed Inventory",
  "Feed Consumption", "Equipment and Tools",
];
const OWNER_CATEGORIES = [
  ...FARMER_CATEGORIES,
  "Sales Record", "Expense Record", "Personnel and Manpower", "Visitor's Log",
];
const categoriesFor = (person) => {
  const role = person?.user?.role || person?.role || "";
  return role === "Owner" ? OWNER_CATEGORIES : FARMER_CATEGORIES;
};

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
  const { id, taskId } = useParams();

  const [person, setPerson] = useState(null);
  const personName = fullName(person);

  const [formData, setFormData] = useState({
    work: "",
    assignedDate: "",
    dueDate: "",
    priority: "Medium",
    status: "Pending",
    category: "",
    notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      getPersonnel(id).then((json) => json.record || json.data || json).catch(() => null),
      getPersonnelTask(id, taskId).then((json) => json.task || json.record || json.data || json).catch((err) => { throw err; }),
    ])
      .then(([personRec, t]) => {
        setPerson(personRec);
        if (t) {
          setFormData({
            work: t.title || t.work || t.task || "",
            assignedDate: toDateInput(t.assignedDate) || t.assignedDate || "",
            dueDate: toDateInput(t.dueDate) || t.dueDate || "",
            priority: t.priority || "Medium",
            status: t.status || "Pending",
            category: t.type || t.module || categoriesFor(personRec)[0],
            notes: t.description || t.notes || "",
          });
        } else {
          setError("Task not found.");
        }
      })
      .catch((err) => setError(err?.message || "Couldn't load this task."))
      .finally(() => setLoading(false));
  }, [id, taskId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (window.__pbSaving) return;
    window.__pbSaving = true;
    setSaving(true); setError("");

    const payload = {
      work: formData.work,
      module: formData.category,
      description: formData.notes,
      assignedDate: formData.assignedDate,
      dueDate: formData.dueDate,
      priority: formData.priority,
      status: formData.status,
    };

    console.log("Submitting payload:", payload);

    try {
      await updatePersonnelTask(id, taskId, payload);
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { }
      navigate(`/personnel-visitors/personnel/view/${id}`);
    } catch (err) {
      setError(err?.message || "Couldn't save changes. Please try again.");
    } finally {
      setSaving(false);
      window.__pbSaving = false;
    }
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

          {error && <div className="pb-error-banner">{error}</div>}

          <div className="et-for-banner">
            <span className="et-tfb-avatar">{initials(personName)}</span>
            <div>
              <div className="et-tfb-label">Task assigned to</div>
              <div className="et-tfb-name">{personName}</div>
            </div>
          </div>

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

          <div className="et-form-group et-full-width">
            <label>Category <span className="et-req">*</span></label>
            <select name="category" value={formData.category} onChange={handleChange} required>
              {categoriesFor(person).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

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

          <div className="et-form-actions">
            <p className="et-req-note">Fields with * are required.</p>
            <div className="et-action-btns">
              <button type="button" className="et-cancel-btn" onClick={() => navigate(`/personnel-visitors/personnel/view/${id}`)} disabled={saving}>
                <FiX /> Cancel
              </button>
              <button type="submit" className="et-save-btn" disabled={saving}>
                <FiSave /> {saving ? "Saving..." : "Update Record"}
              </button>
            </div>
          </div>
        </form>
    </PageLayout>
  );
}