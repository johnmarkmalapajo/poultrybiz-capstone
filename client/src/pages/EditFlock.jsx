import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiInfo,
  FiPackage,
  FiFileText,
  FiSave,
  FiMenu,
} from "react-icons/fi";

import Sidebar, { openSidebar } from "../components/Sidebar";
import batchStore from "../batchStore";
import "./EditFlock.css";

const FLOCKS_API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/flocks`;
const FLOCK_STATUSES = ["Active", "Quarantined", "Completed", "Culled"];

function computeAgeWeeks(dateStr) {
  if (!dateStr) return "";
  const start = new Date(dateStr);
  if (isNaN(start)) return "";
  const weeksElapsed = Math.max(0, Math.floor((Date.now() - start.getTime()) / (86400000 * 7)));
  return `${16 + weeksElapsed} weeks`;
}

export default function EditFlock() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [formData, setFormData] = useState({
    batchId: "",
    breed: "",
    source: "",
    dateAcquired: "",
    quantityPurchased: "",
    totalMortality: 0,
    status: "Active",
    notes: "",
  });

  const [loading, setLoading] = useState(true);

  // ── Load this flock record from batchStore (localStorage) ──
  useEffect(() => {
    const rec = batchStore.getBatch(id);
    if (rec) {
      setFormData((prev) => ({
        ...prev,
        ...rec,
        dateAcquired: rec.dateAcquired ? String(rec.dateAcquired).slice(0, 10) : "",
        totalMortality:
          rec.totalMortality ??
          (rec.quantityPurchased != null && rec.currentQuantity != null
            ? Number(rec.quantityPurchased) - Number(rec.currentQuantity)
            : 0),
      }));
    }
    setLoading(false);
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ── Read-only computed values ──
  const purchaseQty    = Number(formData.quantityPurchased) || 0;
  const totalMortality = Number(formData.totalMortality) || 0;
  const currentBirds   = Math.max(0, purchaseQty - totalMortality);
  const mortalityRate  = purchaseQty > 0 ? ((totalMortality / purchaseQty) * 100).toFixed(2) : "0.00";
  const ageDisplay     = computeAgeWeeks(formData.dateAcquired);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      currentQuantity: currentBirds,
      totalMortality,
      mortalityRate: Number(mortalityRate),
    };
    batchStore.updateBatch(id, payload);   // persist changes to localStorage
    navigate("/records/flock");            // back to Flock Profile — updated row shows
  };

  if (loading) {
    return (
      <div className="edit-flock-page">
        <Sidebar />
        <div className="edit-flock-main">
          <p className="edit-flock-loading">Loading flock record...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-flock-page">
      <Sidebar />

      <div className="edit-flock-main">

        {/* Breadcrumb */}
        <div className="edit-flock-breadcrumb">
          <button className="edit-flock-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="breadcrumb-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span>›</span>
          <span className="breadcrumb-link" onClick={() => navigate("/records/flock")}>FLOCK PROFILE</span>
          <span>›</span>
          <span className="breadcrumb-current">EDIT FLOCK</span>
        </div>

        {/* Header */}

        <form className="flock-form-card" onSubmit={handleSubmit}>

          {/* BATCH INFORMATION */}
          <div className="section-header">
            <FiInfo />
            <h3>BATCH INFORMATION</h3>
            <div className="line"></div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Batch ID</label>
              <input type="text" name="batchId" value={formData.batchId} disabled />
              <small>Batch ID cannot be changed after creation</small>
            </div>

            <div className="form-group">
              <label>Status <span className="req">*</span></label>
              <select name="status" value={formData.status} onChange={handleChange} required>
                {FLOCK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Breed <span className="req">*</span></label>
              <select name="breed" value={formData.breed} onChange={handleChange} required>
                <option value="">Select Breed</option>
                <option value="Hy-Line W-36">Hy-Line W-36</option>
                <option value="Lohmann LSL Lite">Lohmann LSL Lite</option>
                <option value="Dekalb White">Dekalb White</option>
                <option value="Shaver White">Shaver White</option>
                <option value="Hendrix White">Hendrix White</option>
              </select>
            </div>

            <div className="form-group">
              <label>Source <span className="req">*</span></label>
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
              <label>Date Acquired <span className="req">*</span></label>
              <input
                type="date"
                name="dateAcquired"
                value={formData.dateAcquired}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* BIRD INFORMATION */}
          <div className="section-header">
            <FiPackage />
            <h3>BIRD INFORMATION</h3>
            <div className="line"></div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Purchase Quantity <span className="req">*</span></label>
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

            <div className="form-group">
              <label>Current Birds</label>
              <input type="text" value={currentBirds} disabled readOnly />
              <small>Purchase Qty − Total Mortality ({totalMortality} recorded)</small>
            </div>

            <div className="form-group">
              <label>Mortality Rate</label>
              <input type="text" value={`${mortalityRate}%`} disabled readOnly />
              <small>(Total Mortality ÷ Purchase Qty) × 100</small>
            </div>

            <div className="form-group">
              <label>Age (Days)</label>
              <input type="text" value={ageDisplay || "—"} disabled readOnly />
              <small>Starts at 16 weeks on arrival; auto-computed from Date Acquired</small>
            </div>
          </div>

          {/* ADDITIONAL INFORMATION */}
          <div className="section-header">
            <FiFileText />
            <h3>ADDITIONAL INFORMATION</h3>
            <div className="line"></div>
          </div>

          <div className="form-group full-width">
            <label>Remarks <span style={{ color: "#a39e94", fontWeight: 400 }}>(optional)</span></label>
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
            <button type="button" className="cancel-btn" onClick={() => navigate("/records/flock")}>
              Cancel
            </button>
            <button type="submit" className="save-btn">
              <FiSave />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
