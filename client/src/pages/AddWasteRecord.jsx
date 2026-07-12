import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSave, FiX, FiMenu, FiTrash2, FiFileText } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./AddWasteRecord.css";

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  const [saving, setSaving] = useState(false);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (window.__pbSaving) return;  // prevent duplicate submissions
    window.__pbSaving = true;
    try {
      setSaving(true);
      await fetch(`/api/waste-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, recordType: "Waste" }),
      });
    } catch {
      setSaving(false); /* saving is local (mock API) — ignore network errors */ }
    finally { window.__pbSaving = false; }

    navigate("/records/manure?tab=waste");
  };

  return (
    <div className="awr-page">
      <Sidebar />

      <div className="awr-main">

        {/* Breadcrumb */}
        <div className="awr-breadcrumb">
          <button className="awr-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="awr-bc-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span className="awr-bc-sep">›</span>
          <span className="awr-bc-link" onClick={() => navigate("/records/manure?tab=waste")}>MANURE AND WASTE RECORD</span>
          <span className="awr-bc-sep">›</span>
          <span className="awr-bc-current">ADD WASTE</span>
        </div>

        {/* Header */}

        <form className="awr-form-card" onSubmit={handleSubmit}>

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
              <select name="personResponsible" value={formData.personResponsible} onChange={handleChange} required>
                <option value="">Select person</option>
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
      </div>
    </div>
  );
}
