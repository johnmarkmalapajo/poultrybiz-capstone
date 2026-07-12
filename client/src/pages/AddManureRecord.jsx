import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSave, FiX, FiMenu, FiPackage, FiFileText, FiClipboard } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./AddManureRecord.css";

export default function AddManureRecord() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    date: "",
    batchId: "",
    quantityCollected: "",
    methodOfHandling: "",
    storageLocation: "",
    endUse: "",
    personResponsible: "",
    areaCleaned: "",
    toolsUsed: "",
    wasteManagement: "",
    fertilizerHarvested: "",
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
      await fetch(`/api/manure-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, recordType: "Manure" }),
      });
    } catch {
      setSaving(false); /* saving is local (mock API) — ignore network errors */ }
    finally { window.__pbSaving = false; }

    navigate("/records/manure");
  };

  return (
    <div className="amn-page">
      <Sidebar />

      <div className="amn-main">

        {/* Breadcrumb */}
        <div className="amn-breadcrumb">
          <button className="amn-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="amn-bc-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span className="amn-bc-sep">›</span>
          <span className="amn-bc-link" onClick={() => navigate("/records/manure")}>MANURE AND WASTE RECORD</span>
          <span className="amn-bc-sep">›</span>
          <span className="amn-bc-current">ADD MANURE</span>
        </div>

        {/* Header */}

        <form className="amn-form-card" onSubmit={handleSubmit}>

          {/* MANURE DETAILS */}
          <div className="amn-section-header">
            <FiPackage />
            <h3>Manure Details</h3>
            <div className="amn-line" />
          </div>

          <div className="amn-form-grid">
            <div className="amn-form-group">
              <label>Date <span className="amn-req">*</span></label>
              <input type="date" name="date" value={formData.date} onChange={handleChange} required />
            </div>

            <div className="amn-form-group">
              <label>Batch ID / House No. <span className="amn-req">*</span></label>
              <select name="batchId" value={formData.batchId} onChange={handleChange} required>
                <option value="">Select batch / house</option>
              </select>
            </div>

            <div className="amn-form-group">
              <label>Quantity of Manure Collected <span className="amn-req">*</span></label>
              <div className="amn-input-unit">
                <input type="number" min="0" name="quantityCollected" value={formData.quantityCollected}
                  onChange={handleChange} placeholder="Enter quantity" required />
                <span className="amn-unit">kg</span>
              </div>
            </div>

            <div className="amn-form-group">
              <label>Method of Handling <span className="amn-req">*</span></label>
              <select name="methodOfHandling" value={formData.methodOfHandling} onChange={handleChange} required>
                <option value="">Select method</option>
                <option value="Composting">Composting</option>
                <option value="Drying">Drying</option>
                <option value="Biogas">Biogas</option>
                <option value="Direct Application">Direct Application</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="amn-form-group">
              <label>Storage Location <span className="amn-req">*</span></label>
              <input type="text" name="storageLocation" value={formData.storageLocation}
                onChange={handleChange} placeholder="Enter storage location" required />
            </div>

            <div className="amn-form-group">
              <label>End Use / Disposal <span className="amn-req">*</span></label>
              <select name="endUse" value={formData.endUse} onChange={handleChange} required>
                <option value="">Select end use / disposal</option>
                <option value="Used as fertilizer">Used as fertilizer</option>
                <option value="Sold">Sold</option>
                <option value="Composted">Composted</option>
                <option value="Biogas">Biogas</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="amn-form-group">
              <label>Person Responsible <span className="amn-req">*</span></label>
              <select name="personResponsible" value={formData.personResponsible} onChange={handleChange} required>
                <option value="">Select person</option>
              </select>
            </div>
          </div>

          {/* SANITATION & FERTILIZER (maintenance-log requirement) */}
          <div className="amn-section-header">
            <FiClipboard />
            <h3>Sanitation &amp; Fertilizer</h3>
            <div className="amn-line" />
          </div>

          <div className="amn-form-grid">
            <div className="amn-form-group">
              <label>Area Cleaned</label>
              <input type="text" name="areaCleaned" value={formData.areaCleaned} onChange={handleChange}
                placeholder="e.g. Layer house A, cages 1–10" />
            </div>

            <div className="amn-form-group">
              <label>Tools / Equipment Used</label>
              <input type="text" name="toolsUsed" value={formData.toolsUsed} onChange={handleChange}
                placeholder="e.g. shovel, sprayer, disinfectant" />
            </div>

            <div className="amn-form-group">
              <label>Waste Management Action</label>
              <input type="text" name="wasteManagement" value={formData.wasteManagement} onChange={handleChange}
                placeholder="e.g. composted, sterilized, hauled out" />
            </div>

            <div className="amn-form-group">
              <label>Fertilizer Harvested (kg)</label>
              <input type="number" min="0" step="0.1" name="fertilizerHarvested" value={formData.fertilizerHarvested}
                onChange={handleChange} placeholder="0" />
            </div>
          </div>

          {/* ADDITIONAL INFORMATION */}
          <div className="amn-section-header">
            <FiFileText />
            <h3>Additional Information</h3>
            <div className="amn-line" />
          </div>

          <div className="amn-form-group amn-full-width">
            <label>Remarks</label>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange}
              placeholder="Enter any remarks (optional)..." maxLength={255} />
            <small className="amn-char-count">{formData.remarks.length} / 255</small>
          </div>

          {/* Actions */}
          <div className="amn-form-actions">
            <p className="amn-req-note">Fields with * are required.</p>
            <div className="amn-action-btns">
              <button type="button" className="amn-cancel-btn" onClick={() => navigate("/records/manure")}>
                <FiX /> Cancel
              </button>
              <button type="submit" disabled={saving} className="amn-save-btn">
                <FiSave /> Save Record
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
