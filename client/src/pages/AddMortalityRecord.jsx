import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSave, FiX, FiMenu, FiHeart, FiFileText } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./AddMortalityRecord.css";

export default function AddMortalityRecord() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    date: "",
    batchId: "",
    numberOfMortality: "",
    causeOfDeath: "",
    remarks: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // API integration here later
    navigate("/records/mortality");
  };

  return (
    <div className="amr-page">
      <Sidebar />

      <div className="amr-main">

        {/* Breadcrumb */}
        <div className="amr-breadcrumb">
          <button className="amr-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="amr-bc-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span className="amr-bc-sep">›</span>
          <span className="amr-bc-link" onClick={() => navigate("/records/mortality")}>MORTALITY RECORD</span>
          <span className="amr-bc-sep">›</span>
          <span className="amr-bc-current">ADD MORTALITY</span>
        </div>

        {/* Header */}
        <div className="amr-header">
          <div>
            <h2>Add Mortality Record</h2>
            <p>Log a bird mortality event for a flock, including the number that died, the cause, and any observations.</p>
          </div>
        </div>

        <form className="amr-form-card" onSubmit={handleSubmit}>

          {/* MORTALITY DETAILS */}
          <div className="amr-section-header">
            <FiHeart />
            <h3>Mortality Details</h3>
            <div className="amr-line" />
          </div>

          <div className="amr-form-grid">
            <div className="amr-form-group">
              <label>Date <span className="amr-req">*</span></label>
              <input type="date" name="date" value={formData.date} onChange={handleChange} required />
            </div>

            <div className="amr-form-group">
              <label>Batch ID <span className="amr-req">*</span></label>
              <select name="batchId" value={formData.batchId} onChange={handleChange} required>
                <option value="">Select batch ID</option>
              </select>
            </div>

            <div className="amr-form-group">
              <label>Number of Mortality <span className="amr-req">*</span></label>
              <input type="number" min="1" name="numberOfMortality"
                value={formData.numberOfMortality} onChange={handleChange}
                placeholder="Enter number of mortality" required />
            </div>

            <div className="amr-form-group">
              <label>Cause of Death <span className="amr-req">*</span></label>
              <select name="causeOfDeath" value={formData.causeOfDeath} onChange={handleChange} required>
                <option value="">Select cause of death</option>
                <option value="Disease">Disease</option>
                <option value="Heat Stress">Heat Stress</option>
                <option value="Injury">Injury</option>
                <option value="Weak Chicks">Weak Chicks</option>
                <option value="Unknown">Unknown</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* ADDITIONAL INFORMATION */}
          <div className="amr-section-header">
            <FiFileText />
            <h3>Additional Information</h3>
            <div className="amr-line" />
          </div>

          <div className="amr-form-group amr-full-width">
            <label>Remarks / Observations</label>
            <textarea name="remarks"
              value={formData.remarks} onChange={handleChange}
              placeholder="Enter remarks or observations..." maxLength={500} />
            <small className="amr-char-count">{formData.remarks.length} / 500</small>
          </div>

          {/* Actions */}
          <div className="amr-form-actions">
            <p className="amr-req-note">Fields with * are required.</p>
            <div className="amr-action-btns">
              <button type="button" className="amr-cancel-btn" onClick={() => navigate("/records/mortality")}>
                <FiX /> Cancel
              </button>
              <button type="submit" className="amr-save-btn">
                <FiSave /> Save Record
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}