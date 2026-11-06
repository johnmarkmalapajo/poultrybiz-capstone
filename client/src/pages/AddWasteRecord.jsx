import { useNavigate } from "react-router-dom";
import { FiSave, FiX, FiTrash2, FiFileText } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./AddWasteRecord.css";
import { createWasteRecord } from "../api/wasteManure";
import { listPersonnel } from "../api/personnelManpower";
import { useState, useEffect } from "react";
import { useWasteOptions, NEW_VALUE, CUSTOM_MAX_LENGTH, validateCustom, normalizeCustom } from "../hooks/useWasteOptions";
import { phToday } from "../phDate";
import { useLanguage } from "../i18n/LanguageContext";

export default function AddWasteRecord() {
  const { t: tr } = useLanguage();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    date: phToday(),
    wasteType: "",
    quantity: "",
    unit: "kg",
    disposalMethod: "",
    personResponsible: "",
    remarks: "",
  });

  const [personnel, setPersonnel] = useState([]);
  const [newWasteType, setNewWasteType] = useState("");
  const [newDisposalMethod, setNewDisposalMethod] = useState("");
  const { wasteTypeOptions, disposalMethodOptions } = useWasteOptions();
  useEffect(() => {
  listPersonnel()
    .then((list) => {
      const names = [
        ...new Set(
          list
            .map(
              (p) =>
                p.user?.name ||
                p.user?.fullName ||
                p.name ||
                p.fullName
            )
            .filter(Boolean)
        ),
      ];

      setPersonnel(names);
    })
    .catch(() => setPersonnel([]));
}, []);

  const [error, setError] = useState("");
  const handleChange = (e) => {
    const { name } = e.target;
    let value = e.target.value;
    // iOS date pickers ignore the `max` attribute, so enforce it here too.
    const futureBlocked = e.target.type === "date" && e.target.max && value > e.target.max;
    if (futureBlocked) value = e.target.max;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(futureBlocked ? tr("Date cannot be a future date.") : "");
  };
  const [saving, setSaving] = useState(false);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (window.__pbSaving) return;  // prevent duplicate submissions

    if (formData.wasteType === NEW_VALUE) {
      const msg = validateCustom(newWasteType, "waste type");
      if (msg) { setError(msg); return; }
    }
    if (formData.disposalMethod === NEW_VALUE) {
      const msg = validateCustom(newDisposalMethod, "disposal method");
      if (msg) { setError(msg); return; }
    }

    window.__pbSaving = true;
    setSaving(true);
    setError("");
    try {
      await createWasteRecord({
        ...formData,
        recordType: "Waste",
        ...(formData.wasteType === NEW_VALUE
          ? { wasteType: undefined, newWasteType: normalizeCustom(newWasteType) }
          : {}),
        ...(formData.disposalMethod === NEW_VALUE
          ? { disposalMethod: undefined, newDisposalMethod: normalizeCustom(newDisposalMethod) }
          : {}),
      });
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { /* ignore */ }
      navigate("/records/manure?tab=waste");
    } catch (err) {
      setError(tr(err?.message || "Couldn't save this record. Please try again."));
      setSaving(false);
    } finally {
      window.__pbSaving = false;
    }
  };

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        { label: "RECORDS", path: "/records" },
        { label: "MANURE AND WASTE RECORD", path: "/records/manure?tab=waste" },
        { label: "ADD WASTE" },
      ]}
    >

        <form className="awr-form-card" onSubmit={handleSubmit}>

          {error && (
            <div className="pb-error-banner">
              {error}
            </div>
          )}

          {/* WASTE DETAILS */}
          <div className="awr-section-header">
            <FiTrash2 />
            <h3>{tr("Waste Details")}</h3>
            <div className="awr-line" />
          </div>

          <div className="awr-form-grid">
            <div className="awr-form-group">
              <label>{tr("Date")}{" "}<span className="awr-req">*</span></label>
              <input type="date" name="date" value={formData.date} onChange={handleChange} max={phToday()} required />
            </div>

            <div className="awr-form-group">
              <label>{tr("Waste Type")}{" "}<span className="awr-req">*</span></label>
              <select name="wasteType" value={formData.wasteType} onChange={handleChange} required>
                <option value="">{tr("Select waste type")}</option>
                {wasteTypeOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                <option value={NEW_VALUE}>{tr("Others")}</option>
              </select>
              {formData.wasteType === NEW_VALUE && (
                <input
                  type="text"
                  className="awr-others-input"
                  value={newWasteType}
                  onChange={(e) => { setNewWasteType(e.target.value); setError(""); }}
                  placeholder={tr("Enter specific waste type")}
                  maxLength={CUSTOM_MAX_LENGTH}
                  style={{ marginTop: "8px" }}
                  required
                />
              )}
            </div>

            <div className="awr-form-group">
              <label>{tr("Quantity / Unit")}{" "}<span className="awr-req">*</span></label>
              <div className="awr-input-unit-select">
                <input type="number" min="0" name="quantity" value={formData.quantity}
                  onChange={handleChange} placeholder={tr("Enter quantity")} required />
                <select name="unit" value={formData.unit} onChange={handleChange}>
                  <option value="kg">{tr("kg")}</option>
                  <option value="pcs">{tr("pcs")}</option>
                  <option value="heads">{tr("heads")}</option>
                  <option value="bags">{tr("bags")}</option>
                  <option value="liters">{tr("liters")}</option>
                </select>
              </div>
            </div>

            <div className="awr-form-group">
              <label>{tr("Disposal Method")}{" "}<span className="awr-req">*</span></label>
              <select name="disposalMethod" value={formData.disposalMethod} onChange={handleChange} required>
                <option value="">{tr("Select disposal method")}</option>
                {disposalMethodOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                <option value={NEW_VALUE}>{tr("Others")}</option>
              </select>
              {formData.disposalMethod === NEW_VALUE && (
                <input
                  type="text"
                  className="awr-others-input"
                  value={newDisposalMethod}
                  onChange={(e) => { setNewDisposalMethod(e.target.value); setError(""); }}
                  placeholder={tr("Enter specific disposal method")}
                  maxLength={CUSTOM_MAX_LENGTH}
                  style={{ marginTop: "8px" }}
                  required
                />
              )}
            </div>

            <div className="awr-form-group">
              <label>{tr("Person Responsible")}{" "}<span className="awr-req">*</span></label>
              <select
  name="personResponsible"
  value={formData.personResponsible}
  onChange={handleChange}
  required
>
  <option value="">{tr("Select person")}</option>
  {personnel.map((person) => (
    <option key={person} value={person}>
      {person}
    </option>
  ))}
</select>
            </div>
          </div>

          {/* ADDITIONAL INFORMATION */}
          <div className="awr-section-header">
            <FiFileText />
            <h3>{tr("Additional Information")}</h3>
            <div className="awr-line" />
          </div>

          <div className="awr-form-group awr-full-width">
            <label>{tr("Remarks")}</label>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange}
              placeholder={tr("Enter any remarks (optional)...")} maxLength={255} />
            <small className="awr-char-count">{formData.remarks.length} / 255</small>
          </div>

          {/* Actions */}
          <div className="awr-form-actions">
            <p className="awr-req-note">{tr("Fields with * are required.")}</p>
            <div className="awr-action-btns">
              <button type="button" className="awr-cancel-btn" onClick={() => navigate("/records/manure?tab=waste")}>
                <FiX />{" "}{tr("Cancel")}</button>
              <button type="submit" disabled={saving} className="awr-save-btn">
                <FiSave /> {saving ? "Saving..." : "Save Record"}
              </button>
            </div>
          </div>

        </form>

    </PageLayout>
  );
}