import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiSave, FiX, FiTrash2, FiFileText } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditWasteRecord.css";
import { getWasteRecord, updateWasteRecord } from "../api/wasteManure";

export default function EditWasteRecord() {
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

  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const json = await getWasteRecord(id);
        const rec = json.record || json.data || json;
        setFormData((prev) => ({ ...prev, ...rec }));
      } catch (err) {
        setError(err?.message || "Couldn't load this record.");
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    try {
      setSaving(true);
      await updateWasteRecord(id, formData);
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { /* ignore */ }
      navigate("/records/manure?tab=waste");
    } catch (err) {
      setSaving(false);
      setError(err?.message || "Couldn't save changes. Please try again.");
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
        <p className="pb-loading-text">Loading record...</p>
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
            <h3>Waste Details</h3>
            <div className="ewr-line" />
          </div>

          <div className="ewr-form-grid">
            <div className="ewr-form-group">
              <label>Date <span className="ewr-req">*</span></label>
              <input type="date" name="date"
                value={formData.date ? String(formData.date).slice(0, 10) : ""}
                onChange={handleChange} required />
            </div>

            <div className="ewr-form-group">
              <label>Waste Type <span className="ewr-req">*</span></label>
              <select name="wasteType" value={formData.wasteType} onChange={handleChange} required>
                <option value="">Select waste type</option>
                <option value="Dead Birds">Dead Birds</option>
                <option value="Plastic Waste">Plastic Waste</option>
                <option value="Feed Bags">Feed Bags</option>
                <option value="Broken Eggs">Broken Eggs</option>
                <option value="Chemical Containers">Chemical Containers</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="ewr-form-group">
              <label>Quantity / Unit <span className="ewr-req">*</span></label>
              <div className="ewr-input-unit-select">
                <input type="number" min="0" name="quantity" value={formData.quantity}
                  onChange={handleChange} placeholder="Enter quantity" required />
                <select name="unit" value={formData.unit} onChange={handleChange}>
                  <option value="kg">kg</option>
                  <option value="pcs">pcs</option>
                  <option value="heads">heads</option>
                  <option value="bags">bags</option>
                  <option value="liters">liters</option>
                </select>
              </div>
            </div>

            <div className="ewr-form-group">
              <label>Disposal Method <span className="ewr-req">*</span></label>
              <select name="disposalMethod" value={formData.disposalMethod} onChange={handleChange} required>
                <option value="">Select disposal method</option>
                <option value="Burial">Burial</option>
                <option value="Burning">Burning</option>
                <option value="Recycling">Recycling</option>
                <option value="Composting">Composting</option>
                <option value="Disposal">Disposal</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="ewr-form-group">
              <label>Person Responsible <span className="ewr-req">*</span></label>
              <select name="personResponsible" value={formData.personResponsible} onChange={handleChange} required>
                <option value="">Select person</option>
                {formData.personResponsible && (
                  <option value={formData.personResponsible}>{formData.personResponsible}</option>
                )}
              </select>
            </div>
          </div>

          {/* ADDITIONAL INFORMATION */}
          <div className="ewr-section-header">
            <FiFileText />
            <h3>Additional Information</h3>
            <div className="ewr-line" />
          </div>

          <div className="ewr-form-group ewr-full-width">
            <label>Remarks</label>
            <textarea name="remarks" value={formData.remarks || ""} onChange={handleChange}
              placeholder="Enter any remarks (optional)..." maxLength={255} />
            <small className="ewr-char-count">{(formData.remarks || "").length} / 255</small>
          </div>

          {/* Actions */}
          <div className="ewr-form-actions">
            <p className="ewr-req-note">Fields with * are required.</p>
            <div className="ewr-action-btns">
              <button type="button" className="ewr-cancel-btn" onClick={() => navigate("/records/manure?tab=waste")}>
                <FiX /> Cancel
              </button>
              <button type="submit" disabled={saving} className="ewr-save-btn">
                <FiSave /> Update Record
              </button>
            </div>
          </div>

        </form>

    </PageLayout>
  );
}