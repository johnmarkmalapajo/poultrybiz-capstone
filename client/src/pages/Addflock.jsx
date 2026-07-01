import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiInfo,
  FiPackage,
  FiActivity,
  FiFileText,
  FiSave,
  FiMenu,
} from "react-icons/fi";

import Sidebar, { openSidebar } from "../components/Sidebar";
import "./Addflock.css";

// Days from a date string until today
function computeAge(dateStr) {
  if (!dateStr) return "";
  const start = new Date(dateStr);
  if (isNaN(start)) return "";
  const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
  return `${days} days`;
}

export default function AddFlock() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    batchId: "",
    breed: "",
    source: "",
    dateAcquired: "",
    quantityPurchased: "",
    notes: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Flock Data:", formData);
    // API integration later
  };

  // Auto-computed previews (mirror the Flock Profile table columns)
  const currentQty = formData.quantityPurchased || "";
  const ageDisplay = computeAge(formData.dateAcquired);

  return (
    <div className="add-flock-page">
      <Sidebar />

      <div className="add-flock-main">

        {/* Breadcrumb */}
        <div className="add-flock-breadcrumb">
          <button className="add-flock-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="breadcrumb-link" onClick={() => navigate("/records")}>
            RECORDS
          </span>
          <span>›</span>
          <span className="breadcrumb-link" onClick={() => navigate("/records/flock")}>
            FLOCK PROFILE
          </span>
          <span>›</span>
          <span className="breadcrumb-current">ADD NEW FLOCK</span>
        </div>

        {/* Header */}
        <div className="add-flock-header">
          <div>
            <h2>Add New Flock</h2>
            <p>
              Create a new flock profile that will serve as the
              central record for egg, mortality, health,
              quarantine, and manure tracking.
            </p>
          </div>
        </div>

        <form className="flock-form-card" onSubmit={handleSubmit}>

          {/* FLOCK INFORMATION */}
          <div className="section-header">
            <FiInfo />
            <h3>FLOCK INFORMATION</h3>
            <div className="line"></div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Batch ID</label>
              <input
                type="text"
                name="batchId"
                value={formData.batchId}
                onChange={handleChange}
                placeholder="Auto-generated"
                disabled
              />
              <small>Generated automatically after saving</small>
            </div>

            <div className="form-group">
              <label>Breed *</label>
              <select
                name="breed"
                value={formData.breed}
                onChange={handleChange}
                required
              >
                <option value="">Select Breed</option>
                <option value="Dekalb White">Dekalb White</option>
                <option value="Lohmann Brown">Lohmann Brown</option>
                <option value="Hy-Line Brown">Hy-Line Brown</option>
                <option value="Native Chicken">Native Chicken</option>
              </select>
            </div>

            <div className="form-group">
              <label>Source *</label>
              <input
                type="text"
                name="source"
                value={formData.source}
                onChange={handleChange}
                placeholder="Supplier / Hatchery"
                required
              />
            </div>

            <div className="form-group">
              <label>Date Acquired *</label>
              <input
                type="date"
                name="dateAcquired"
                value={formData.dateAcquired}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* QUANTITY INFORMATION */}
          <div className="section-header">
            <FiPackage />
            <h3>QUANTITY INFORMATION</h3>
            <div className="line"></div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Purchase Qty *</label>
              <input
                type="number"
                min="1"
                name="quantityPurchased"
                value={formData.quantityPurchased}
                onChange={handleChange}
                placeholder="Enter number of birds"
                required
              />
            </div>
          </div>

          {/* AUTO-COMPUTED — mirrors the Flock Profile table */}
          <div className="section-header">
            <FiActivity />
            <h3>AUTO-COMPUTED</h3>
            <div className="line"></div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Current Qty</label>
              <input type="text" value={currentQty} placeholder="—" disabled />
              <small>Starts equal to Purchase Qty; decreases with recorded mortality</small>
            </div>

            <div className="form-group">
              <label>Mortality Rate</label>
              <input type="text" value="0%" disabled />
              <small>(Purchased − Current) ÷ Purchased × 100</small>
            </div>

            <div className="form-group">
              <label>Age</label>
              <input type="text" value={ageDisplay} placeholder="—" disabled />
              <small>Days counted from Date Acquired</small>
            </div>
          </div>

          {/* ADDITIONAL INFORMATION */}
          <div className="section-header">
            <FiFileText />
            <h3>ADDITIONAL INFORMATION</h3>
            <div className="line"></div>
          </div>

          <div className="form-group full-width">
            <label>Notes</label>
            <textarea
              rows="6"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Enter remarks, observations, or additional information..."
            />
          </div>

          {/* Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={() => navigate("/records/flock")}
            >
              Cancel
            </button>
            <button type="submit" className="save-btn">
              <FiSave />
              Save Flock Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}