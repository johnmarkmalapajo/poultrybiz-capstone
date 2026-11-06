import { phToday } from "../phDate";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiClipboard, FiCalendar, FiFlag, FiFileText, FiSave, FiX } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./AddTask.css";
import { createPersonnelTask } from "../api/personnelManpower";
import { getPersonnel } from "../api/personnelManpower";
import { useLanguage } from "../i18n/LanguageContext";

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
const today = () => phToday();

export default function AddTask() {
  const { t: tr } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();

  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    work: "",
    assignedDate: today(),
    dueDate: "",
    status: "Pending",
    category: "",
    notes: "",
  });

  useEffect(() => {
    setLoading(true);
    getPersonnel(id)
      .then((json) => {
        const rec = json.record || json.data || json;
        setPerson(rec && (rec._id || rec.profile || rec.fullName) ? rec : null);
        setFormData((prev) => ({ ...prev, category: categoriesFor(rec)[0] }));
      })
      .catch((err) => setError(tr(err?.message || "Couldn't load this personnel record.")))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const personName = fullName(person);

  const [saving, setSaving] = useState(false);

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

    try {
  await createPersonnelTask(id, {
  title: formData.work,
  module: formData.category,
  description: formData.notes,
  assignedDate: formData.assignedDate,
  dueDate: formData.dueDate,
  status: formData.status,
  remarks: "",
});
  navigate(`/personnel-visitors/personnel/view/${id}`);
} catch (err) {
      setError(tr(err?.message || "Couldn't assign this task. Please try again."));
    } finally {
      setSaving(false);
      window.__pbSaving = false;
    }
  };

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        { label: "PERSONNEL AND MANPOWER", path: "/personnel-visitors/personnel" },
        { label: "VIEW PERSONNEL", path: `/personnel-visitors/personnel/view/${id}` },
        { label: "ADD TASK" },
      ]}
    >
        <form className="at-form-card" onSubmit={handleSubmit}>

          {error && <div className="pb-error-banner">{error}</div>}

          <div className="at-for-banner">
            <span className="at-tfb-avatar">{initials(personName)}</span>
            <div>
              <div className="at-tfb-label">{tr("Assigning task to")}</div>
              <div className="at-tfb-name">{loading ? "Loading..." : personName}</div>
            </div>
          </div>

          <div className="at-section-header">
            <FiClipboard />
            <h3>{tr("Task Details")}</h3>
            <div className="at-line" />
          </div>

          <div className="at-form-group at-full-width">
            <label>{tr("Work Assigned")}{" "}<span className="at-req">*</span></label>
            <input
              type="text"
              name="work"
              value={formData.work}
              onChange={handleChange}
              placeholder={tr("e.g., Morning feeding (Cage 1-4)")}
              required
            />
          </div>

          <div className="at-form-group at-full-width">
            <label>{tr("Category")}{" "}<span className="at-req">*</span></label>
            <select name="category" value={formData.category} onChange={handleChange} required>
              {categoriesFor(person).map((c) => <option key={c} value={c}>{tr(c)}</option>)}
            </select>
          </div>

          <div className="at-section-header">
            <FiCalendar />
            <h3>{tr("Schedule")}</h3>
            <div className="at-line" />
          </div>

          <div className="at-form-grid">
            <div className="at-form-group">
              <label>{tr("Assigned Date")}{" "}<span className="at-req">*</span></label>
              <input type="date" name="assignedDate" value={formData.assignedDate} onChange={handleChange} required />
            </div>

            <div className="at-form-group">
              <label>{tr("Due Date")}{" "}<span className="at-req">*</span></label>
              <input type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} required />
            </div>
          </div>

          <div className="at-section-header">
            <FiFlag />
            <h3>{tr("Status")}</h3>
            <div className="at-line" />
          </div>

          <div className="at-form-grid">
            <div className="at-form-group">
              <label>{tr("Status")}{" "}<span className="at-req">*</span></label>
              <select name="status" value={formData.status} onChange={handleChange} required>
                {STATUSES.map((s) => <option key={s} value={s}>{tr(s)}</option>)}
              </select>
            </div>
          </div>

          <div className="at-section-header">
            <FiFileText />
            <h3>{tr("Additional Notes")}</h3>
            <div className="at-line" />
          </div>

          <div className="at-form-group at-full-width">
            <label>{tr("Notes")}{" "}<span style={{ color: "#a39e94", fontWeight: 400 }}>{tr("(optional)")}</span></label>
            <textarea
              rows="4"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder={tr("Extra instructions or details...")}
            />
          </div>

          <div className="at-form-actions">
            <p className="at-req-note">{tr("Fields with * are required.")}</p>
            <div className="at-action-btns">
              <button type="button" className="at-cancel-btn" onClick={() => navigate(`/personnel-visitors/personnel/view/${id}`)} disabled={saving}>
                <FiX />{" "}{tr("Cancel")}</button>
              <button type="submit" className="at-save-btn" disabled={saving}>
                <FiSave /> {saving ? "Saving..." : "Save Record"}
              </button>
            </div>
          </div>
        </form>
    </PageLayout>
  );
}