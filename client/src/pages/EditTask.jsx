import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiClipboard, FiCalendar, FiFlag, FiFileText, FiSave, FiX } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditTask.css";
import {getPersonnelTask, updatePersonnelTask,} from "../api/personnelManpower";
import { getPersonnel } from "../api/personnelManpower";
import { useLanguage } from "../i18n/LanguageContext";

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
  const { t: tr } = useLanguage();
  const navigate = useNavigate();
  const { id, taskId } = useParams();

  const [person, setPerson] = useState(null);
  const personName = fullName(person);

  const [formData, setFormData] = useState({
    work: "",
    assignedDate: "",
    estimatedDurationValue: "",
    estimatedDurationUnit: "minutes",
    dueDate: "",
    taskCategory: "Secondary", // Primary/Secondary -- locked after creation
    active: true,
    dateCreated: "",
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
            estimatedDurationValue: t.estimatedDuration?.value != null ? String(t.estimatedDuration.value) : "",
            estimatedDurationUnit: t.estimatedDuration?.unit || "minutes",
            dueDate: toDateInput(t.dueDate) || "",
            taskCategory: t.category === "Primary" ? "Primary" : "Secondary",
            active: t.active !== false,
            dateCreated: t.dateCreated || t.createdAt || "",
            category: t.type || t.module || categoriesFor(personRec)[0],
            notes: t.description || t.notes || "",
          });
        } else {
          setError(tr("Task not found."));
        }
      })
      .catch((err) => setError(tr(err?.message || "Couldn't load this task.")))
      .finally(() => setLoading(false));
  }, [id, taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
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
      active: formData.active,
      // Estimated Duration applies to every category, including Primary.
      // Completion itself is never set from here -- it always requires
      // the Farmer's own Proof of Completion submission (photo + remarks).
      estimatedDuration: formData.estimatedDurationValue
        ? { value: Number(formData.estimatedDurationValue), unit: formData.estimatedDurationUnit }
        : null,
      // Due Date is never applicable to Primary tasks (perpetually
      // recurring); optional for Secondary.
      dueDate: formData.taskCategory === "Primary" ? null : (formData.dueDate || null),
    };

    try {
      await updatePersonnelTask(id, taskId, payload);
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { }
      navigate(`/personnel-visitors/personnel/view/${id}`);
    } catch (err) {
      setError(tr(err?.message || "Couldn't save changes. Please try again."));
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
        <p className="et-loading">{tr("Loading task...")}</p>
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
              <div className="et-tfb-label">{tr("Task assigned to")}</div>
              <div className="et-tfb-name">{personName}</div>
            </div>
          </div>

          <div className="et-section-header">
            <FiClipboard />
            <h3>{tr("Task Details")}</h3>
            <div className="et-line" />
          </div>

          <div className="et-form-group et-full-width">
            <label>{tr("Work Assigned")}{" "}<span className="et-req">*</span></label>
            <input
              type="text"
              name="work"
              value={formData.work}
              onChange={handleChange}
              placeholder={tr("e.g., Morning feeding (Cage 1-4)")}
              required
            />
          </div>

          <div className="et-form-group et-full-width">
            <label>{tr("Category")}{" "}<span className="et-req">*</span></label>
            <select name="category" value={formData.category} onChange={handleChange} required>
              {categoriesFor(person).map((c) => <option key={c} value={c}>{tr(c)}</option>)}
            </select>
          </div>

          <div className="et-form-group et-full-width">
            <label>{tr("Task Type")}</label>
            <span className="todo-archived-tag" title={tr("Task type (Primary/Secondary) cannot be changed after creation.")}>
              {tr(formData.taskCategory === "Primary" ? "Primary — recurring daily responsibility" : "Secondary — one-off special assignment")}
            </span>
          </div>

          <div className="et-section-header">
            <FiCalendar />
            <h3>{tr("Schedule")}</h3>
            <div className="et-line" />
          </div>

          <div className="et-form-grid">
            <div className="et-form-group">
              <label>{tr("Assigned Date")}{" "}<span className="et-req">*</span></label>
              <input type="date" name="assignedDate" value={formData.assignedDate} onChange={handleChange} required />
            </div>

            <div className="et-form-group">
              <label>{tr("Date Created")}</label>
              <span className="todo-archived-tag" title={tr("Automatically recorded when the task was created — never editable.")}>
                {formData.dateCreated ? toDateInput(formData.dateCreated) : "—"}
              </span>
            </div>

            <div className="et-form-group">
              <label>{tr("Estimated Duration")}{" "}<span style={{ color: "#a39e94", fontWeight: 400 }}>{tr("(optional)")}</span></label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  name="estimatedDurationValue"
                  min="0.01"
                  step="any"
                  style={{ flex: 1 }}
                  value={formData.estimatedDurationValue}
                  onChange={handleChange}
                  placeholder={tr("e.g. 30")}
                />
                <select
                  name="estimatedDurationUnit"
                  style={{ flex: 1 }}
                  value={formData.estimatedDurationUnit}
                  onChange={handleChange}
                >
                  <option value="minutes">{tr("Minutes")}</option>
                  <option value="hours">{tr("Hours")}</option>
                </select>
              </div>
            </div>

            {formData.taskCategory === "Secondary" ? (
              <div className="et-form-group">
                <label>{tr("Due Date")}{" "}<span style={{ color: "#a39e94", fontWeight: 400 }}>{tr("(optional)")}</span></label>
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleChange}
                />
              </div>
            ) : (
              <p className="et-req-note">
                {tr("Primary tasks are recurring daily responsibilities — no Due Date applies.")}
              </p>
            )}
          </div>

          <div className="et-section-header">
            <FiFlag />
            <h3>{tr("Status")}</h3>
            <div className="et-line" />
          </div>

          <div className="et-form-grid">
            <div className="et-form-group et-full-width">
              <label>
                <input
                  type="checkbox"
                  name="active"
                  checked={formData.active}
                  onChange={handleChange}
                  style={{ width: 16, height: 16, marginRight: 8, verticalAlign: "middle" }}
                />
                {tr("Active — keeps producing new daily/lifetime occurrences")}
              </label>
              <p className="et-req-note" style={{ marginTop: 6 }}>
                {tr("Completion is submitted by the Farmer with Proof of Completion (photo + remarks) — it can no longer be set directly here. See Personnel › Task History for every submission.")}
              </p>
            </div>
          </div>

          <div className="et-section-header">
            <FiFileText />
            <h3>{tr("Additional Notes")}</h3>
            <div className="et-line" />
          </div>

          <div className="et-form-group et-full-width">
            <label>{tr("Notes")}{" "}<span style={{ color: "#a39e94", fontWeight: 400 }}>{tr("(optional)")}</span></label>
            <textarea
              rows="4"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder={tr("Extra instructions or details...")}
            />
          </div>

          <div className="et-form-actions">
            <p className="et-req-note">{tr("Fields with * are required.")}</p>
            <div className="et-action-btns">
              <button type="button" className="et-cancel-btn" onClick={() => navigate(`/personnel-visitors/personnel/view/${id}`)} disabled={saving}>
                <FiX />{" "}{tr("Cancel")}</button>
              <button type="submit" className="et-save-btn" disabled={saving}>
                <FiSave /> {saving ? "Saving..." : "Update Record"}
              </button>
            </div>
          </div>
        </form>
    </PageLayout>
  );
}