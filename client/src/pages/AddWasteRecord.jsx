import { useNavigate } from "react-router-dom";
import { FiSave, FiX, FiTrash2, FiFileText } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./AddWasteRecord.css";
import { createWasteRecord } from "../api/wasteManure";
import { listPersonnel } from "../api/personnelManpower";
import { useState, useEffect } from "react";

export default function AddWasteRecord() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    date: "",
    wasteType: "",
    quantity: "",
    unit: "kg",
    disposalMethod: "",
    personResponsible: "",
    remarks: "",
  });

  const [personnel, setPersonnel] = useState([]);
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
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };
  const [saving, setSaving] = useState(false);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (window.__pbSaving) return;  // prevent duplicate submissions
    window.__pbSaving = true;
    setSaving(true);
    try {
      await createWasteRecord({ ...formData, recordType: "Waste" });
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { /* ignore */ }
      navigate("/records/manure?tab=waste");
    } catch (err) {
      setError(err?.message || "Couldn't save this record. Please try again.");
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
            <h3>Waste Details</h3>
            <div className="awr-line" />
          </div>

          <div className="awr-form-grid">
            <div className="awr-form-group">
              <label>Date <span className="awr-req">*</span></label>
              <input type="date" name="date" value={formData.date} onChange={handleChange} required />
            </div>

            <div className="awr-form-group">
              <label>Waste Type <span className="awr-req">*</span></label>
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

            <div className="awr-form-group">
              <label>Quantity / Unit <span className="awr-req">*</span></label>
              <div className="awr-input-unit-select">
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

            <div className="awr-form-group">
              <label>Disposal Method <span className="awr-req">*</span></label>
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

            <div className="awr-form-group">
              <label>Person Responsible <span className="awr-req">*</span></label>
              <select
  name="personResponsible"
  value={formData.personResponsible}
  onChange={handleChange}
  required
>
  <option value="">Select person</option>
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
            <h3>Additional Information</h3>
            <div className="awr-line" />
          </div>

          <div className="awr-form-group awr-full-width">
            <label>Remarks</label>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange}
              placeholder="Enter any remarks (optional)..." maxLength={255} />
            <small className="awr-char-count">{formData.remarks.length} / 255</small>
          </div>

          {/* Actions */}
          <div className="awr-form-actions">
            <p className="awr-req-note">Fields with * are required.</p>
            <div className="awr-action-btns">
              <button type="button" className="awr-cancel-btn" onClick={() => navigate("/records/manure?tab=waste")}>
                <FiX /> Cancel
              </button>
              <button type="submit" disabled={saving} className="awr-save-btn">
                <FiSave /> Save Record
              </button>
            </div>
          </div>

        </form>

    </PageLayout>
  );
}