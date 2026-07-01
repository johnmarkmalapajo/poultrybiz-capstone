import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSave, FiX, FiMenu, FiPackage, FiFileText } from "react-icons/fi";
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
    remarks: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
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
        <div className="amn-header">
          <div>
            <h2>Add Manure Record</h2>
            <p>Log manure collected from a batch or house, including how it was handled, stored, and used.</p>
          </div>
        </div>

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
              <button type="submit" className="amn-save-btn">
                <FiSave /> Save Record
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}