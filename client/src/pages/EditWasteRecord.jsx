import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiSave, FiX, FiTrash2, FiFileText } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditWasteRecord.css";
import { getWasteRecord, updateWasteRecord } from "../api/wasteManure";
import { useWasteOptions, NEW_VALUE, CUSTOM_MAX_LENGTH, validateCustom, normalizeCustom } from "../hooks/useWasteOptions";
import { phToday } from "../phDate";
import { useLanguage } from "../i18n/LanguageContext";

export default function EditWasteRecord() {
  const { t: tr } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    date: "",
    wasteType: "",
    quantity: "",
    unit: "kg",
    disposalMethod: "",
    personResponsible: "",
    remarks: "",
  });

  const [error, setError] = useState("");
  const [newWasteType, setNewWasteType] = useState("");
  const [newDisposalMethod, setNewDisposalMethod] = useState("");
  // Values already saved on this record stay selectable (custom or legacy).
  const { wasteTypeOptions, disposalMethodOptions } = useWasteOptions(
    [formData.wasteType],
    [formData.disposalMethod]
  );

  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const json = await getWasteRecord(id);
        const rec = json.record || json.data || json;
        setFormData((prev) => ({ ...prev, ...rec }));
      } catch (err) {
        setError(tr(err?.message || "Couldn't load this record."));
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleChange = (e) => {
    const { name } = e.target;
    let value = e.target.value;
    // iOS date pickers ignore the `max` attribute, so enforce it here too.
    const futureBlocked = e.target.type === "date" && e.target.max && value > e.target.max;
    if (futureBlocked) value = e.target.max;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(futureBlocked ? tr("Date cannot be a future date.") : "");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (formData.wasteType === NEW_VALUE) {
      const msg = validateCustom(newWasteType, "waste type");
      if (msg) { setError(msg); return; }
    }
    if (formData.disposalMethod === NEW_VALUE) {
      const msg = validateCustom(newDisposalMethod, "disposal method");
      if (msg) { setError(msg); return; }
    }

    try {
      setSaving(true);
      setError("");
      await updateWasteRecord(id, {
        ...formData,
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
      setSaving(false);
      setError(tr(err?.message || "Couldn't save changes. Please try again."));
    }
  };

  if (loading) {
    return (
      <PageLayout
        background="#f4f4f2"
        breadcrumbItems={[
          { label: "RECORDS", path: "/records" },
          { label: "MANURE AND WASTE RECORD", path: "/records/manure?tab=waste" },
          { label: "EDIT WASTE" },
        ]}
      >
        <p className="pb-loading-text">{tr("Loading record...")}</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        { label: "RECORDS", path: "/records" },
        { label: "MANURE AND WASTE RECORD", path: "/records/manure?tab=waste" },
        { label: "EDIT WASTE" },
      ]}
    >

        <form className="ewr-form-card" onSubmit={handleSubmit}>

          {error && (
            <div className="pb-error-banner">
              {error}
            </div>
          )}

          {/* WASTE DETAILS */}
          <div className="ewr-section-header">
            <FiTrash2 />
            <h3>{tr("Waste Details")}</h3>
            <div className="ewr-line" />
          </div>

          <div className="ewr-form-grid">
            <div className="ewr-form-group">
              <label>{tr("Date")}{" "}<span className="ewr-req">*</span></label>
              <input type="date" name="date"
                value={formData.date ? String(formData.date).slice(0, 10) : ""}
                onChange={handleChange} max={phToday()} required />
            </div>

            <div className="ewr-form-group">
              <label>{tr("Waste Type")}{" "}<span className="ewr-req">*</span></label>
              <select name="wasteType" value={formData.wasteType} onChange={handleChange} required>
                <option value="">{tr("Select waste type")}</option>
                {wasteTypeOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                <option value={NEW_VALUE}>{tr("Others")}</option>
              </select>
              {formData.wasteType === NEW_VALUE && (
                <input
                  type="text"
                  className="ewr-others-input"
                  value={newWasteType}
                  onChange={(e) => { setNewWasteType(e.target.value); setError(""); }}
                  placeholder={tr("Enter specific waste type")}
                  maxLength={CUSTOM_MAX_LENGTH}
                  style={{ marginTop: "8px" }}
                  required
                />
              )}
            </div>

            <div className="ewr-form-group">
              <label>{tr("Quantity / Unit")}{" "}<span className="ewr-req">*</span></label>
              <div className="ewr-input-unit-select">
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

            <div className="ewr-form-group">
              <label>{tr("Disposal Method")}{" "}<span className="ewr-req">*</span></label>
              <select name="disposalMethod" value={formData.disposalMethod} onChange={handleChange} required>
                <option value="">{tr("Select disposal method")}</option>
                {disposalMethodOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                <option value={NEW_VALUE}>{tr("Others")}</option>
              </select>
              {formData.disposalMethod === NEW_VALUE && (
                <input
                  type="text"
                  className="ewr-others-input"
                  value={newDisposalMethod}
                  onChange={(e) => { setNewDisposalMethod(e.target.value); setError(""); }}
                  placeholder={tr("Enter specific disposal method")}
                  maxLength={CUSTOM_MAX_LENGTH}
                  style={{ marginTop: "8px" }}
                  required
                />
              )}
            </div>

            <div className="ewr-form-group">
              <label>{tr("Person Responsible")}{" "}<span className="ewr-req">*</span></label>
              <select name="personResponsible" value={formData.personResponsible} onChange={handleChange} required>
                <option value="">{tr("Select person")}</option>
                {formData.personResponsible && (
                  <option value={formData.personResponsible}>{formData.personResponsible}</option>
                )}
              </select>
            </div>
          </div>

          {/* ADDITIONAL INFORMATION */}
          <div className="ewr-section-header">
            <FiFileText />
            <h3>{tr("Additional Information")}</h3>
            <div className="ewr-line" />
          </div>

          <div className="ewr-form-group ewr-full-width">
            <label>{tr("Remarks")}</label>
            <textarea name="remarks" value={formData.remarks || ""} onChange={handleChange}
              placeholder={tr("Enter any remarks (optional)...")} maxLength={255} />
            <small className="ewr-char-count">{(formData.remarks || "").length} / 255</small>
          </div>

          {/* Actions */}
          <div className="ewr-form-actions">
            <p className="ewr-req-note">{tr("Fields with * are required.")}</p>
            <div className="ewr-action-btns">
              <button type="button" className="ewr-cancel-btn" onClick={() => navigate("/records/manure?tab=waste")}>
                <FiX />{" "}{tr("Cancel")}</button>
              <button type="submit" disabled={saving} className="ewr-save-btn">
                <FiSave />{" "}{tr("Update Record")}</button>
            </div>
          </div>

        </form>

    </PageLayout>
  );
}