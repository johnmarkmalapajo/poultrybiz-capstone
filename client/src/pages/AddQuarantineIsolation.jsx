import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSave, FiX, FiMenu, FiShield, FiFileText } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./AddQuarantineIsolation.css";

export default function AddQuarantineIsolation() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    dateStarted: "",
    batchId: "",
    numberOfBirds: "",
    status: "",
    dateEnded: "",
    reason: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // API integration here later
    navigate("/records/quarantine");
  };

  return (
    <div className="aqi-page">
      <Sidebar />

      <div className="aqi-main">

        {/* Breadcrumb */}
        <div className="aqi-breadcrumb">
          <button className="aqi-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="aqi-bc-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span className="aqi-bc-sep">›</span>
          <span className="aqi-bc-link" onClick={() => navigate("/records/quarantine")}>QUARANTINE AND ISOLATION</span>
          <span className="aqi-bc-sep">›</span>
          <span className="aqi-bc-current">ADD RECORD</span>
        </div>

        {/* Header */}
        <div className="aqi-header">
          <div>
            <h2>Add Quarantine / Isolation Record</h2>
            <p>Log birds placed under quarantine or isolation, including the batch, count, status, and reason.</p>
          </div>
        </div>

        <form className="aqi-form-card" onSubmit={handleSubmit}>

          {/* QUARANTINE DETAILS */}
          <div className="aqi-section-header">
            <FiShield />
            <h3>Quarantine Details</h3>
            <div className="aqi-line" />
          </div>

          <div className="aqi-form-grid">
            <div className="aqi-form-group">
              <label>Date Started <span className="aqi-req">*</span></label>
              <input
                type="date"
                name="dateStarted"
                value={formData.dateStarted}
                onChange={handleChange}
                required
              />
            </div>

            <div className="aqi-form-group">
              <label>Batch ID <span className="aqi-req">*</span></label>
              <select name="batchId" value={formData.batchId} onChange={handleChange} required>
                <option value="">Select batch ID</option>
              </select>
            </div>

            <div className="aqi-form-group">
              <label>Number of Birds <span className="aqi-req">*</span></label>
              <input
                type="number"
                min="1"
                name="numberOfBirds"
                value={formData.numberOfBirds}
                onChange={handleChange}
                placeholder="Enter number of birds"
                required
              />
            </div>

            <div className="aqi-form-group">
              <label>Status <span className="aqi-req">*</span></label>
              <select name="status" value={formData.status} onChange={handleChange} required>
                <option value="">Select status</option>
                <option value="Isolate">Isolate</option>
                <option value="Recovered">Recovered</option>
                <option value="Deceased">Deceased</option>
              </select>
            </div>

            <div className="aqi-form-group">
              <label>Date Ended <span className="aqi-req">*</span></label>
              <input
                type="date"
                name="dateEnded"
                value={formData.dateEnded}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* REASON */}
          <div className="aqi-section-header">
            <FiFileText />
            <h3>Reason</h3>
            <div className="aqi-line" />
          </div>

          <div className="aqi-form-group aqi-full-width">
            <label>Reason <span className="aqi-optional">(optional)</span></label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Enter reason for quarantine or isolation..."
              maxLength={255}
            />
            <div className="aqi-char-row">
              <small>Briefly describe the reason for quarantine or isolation.</small>
              <small className="aqi-char-count">{formData.reason.length} / 255</small>
            </div>
          </div>

          {/* Actions */}
          <div className="aqi-form-actions">
            <p className="aqi-req-note">Fields with * are required.</p>
            <div className="aqi-action-btns">
              <button type="button" className="aqi-cancel-btn" onClick={() => navigate("/records/quarantine")}>
                <FiX /> Cancel
              </button>
              <button type="submit" className="aqi-save-btn">
                <FiSave /> Save Record
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}