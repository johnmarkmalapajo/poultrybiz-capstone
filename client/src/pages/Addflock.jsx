import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiInfo,
  FiPackage,
  FiFileText,
  FiSave,
  FiX,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import batchStore from "../batchStore";
import "./Addflock.css";

const FLOCK_STATUSES = ["Active", "Quarantined", "Completed", "Culled"];

// Chickens arrive at 16 weeks; current age = 16 + weeks since arrival
function computeAgeWeeks(dateStr) {
  if (!dateStr) return "";
  const start = new Date(dateStr);
  if (isNaN(start)) return "";
  const weeksElapsed = Math.max(0, Math.floor((Date.now() - start.getTime()) / (86400000 * 7)));
  return `${16 + weeksElapsed} weeks`;
}

export default function AddFlock() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    batchId: "",
    breed: "",
    source: "",
    dateAcquired: "",
    quantityPurchased: "",
    status: "Active",
    notes: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ── Auto-generate the next Batch ID (F-001, F-002, ...) ──
  useEffect(() => {
    const batches = batchStore.getBatches();
    let max = 0;
    batches.forEach((b) => {
      const m = /^F-(\d+)$/.exec(b.batchId || "");
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    const next = `F-${String(max + 1).padStart(3, "0")}`;
    setFormData((prev) => ({ ...prev, batchId: next }));
  }, []);

  // ── Read-only placeholders (computed later after backend integration) ──
  const purchaseQty   = Number(formData.quantityPurchased) || 0;
  const currentBirds  = purchaseQty;     // new flock: total mortality = 0
  const mortalityRate = "0.00";          // 0% on creation
  const ageDisplay    = computeAgeWeeks(formData.dateAcquired);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.batchId.trim()) { alert("Please enter a Batch ID."); return; }
    const payload = {
      ...formData,
      batchId: formData.batchId.trim(),
      quantityPurchased: purchaseQty,
      currentQuantity: currentBirds,
      totalMortality: 0,
      mortalityRate: Number(mortalityRate),
      status: formData.status || "Active",
    };
    batchStore.addBatch(payload);       // persist to localStorage (pb_batches)
    navigate("/records/flock");         // back to Flock Profile — new row shows + stays
  };

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        { label: "RECORDS", path: "/records" },
        { label: "FLOCK PROFILE", path: "/records/flock" },
        { label: "ADD NEW FLOCK" },
      ]}
    >
        <form className="af-form-card" onSubmit={handleSubmit}>

          {/* BATCH INFORMATION */}
          <div className="af-section-header">
            <FiInfo />
            <h3>Batch Information</h3>
            <div className="af-line" />
          </div>

          <div className="af-form-grid">
            <div className="af-form-group">
              <label>Batch ID</label>
              <input
                type="text"
                name="batchId"
                value={formData.batchId}
                onChange={handleChange}
                placeholder="Auto-generated"
                disabled
              />
              <small>Generated automatically</small>
            </div>

            <div className="af-form-group">
              <label>Status <span className="af-req">*</span></label>
              <select name="status" value={formData.status} onChange={handleChange} required>
                {FLOCK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="af-form-group">
              <label>Breed <span className="af-req">*</span></label>
              <select name="breed" value={formData.breed} onChange={handleChange} required>
                <option value="">Select Breed</option>
                <option value="Hy-Line W-36">Hy-Line W-36</option>
                <option value="Lohmann LSL Lite">Lohmann LSL Lite</option>
                <option value="Dekalb White">Dekalb White</option>
                <option value="Shaver White">Shaver White</option>
                <option value="Hendrix White">Hendrix White</option>
              </select>
            </div>

            <div className="af-form-group">
              <label>Source <span className="af-req">*</span></label>
              <input
                type="text"
                name="source"
                value={formData.source}
                onChange={handleChange}
                placeholder="Supplier / Hatchery"
                required
              />
            </div>

            <div className="af-form-group">
              <label>Date Acquired <span className="af-req">*</span></label>
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
          <div className="af-section-header">
            <FiPackage />
            <h3>Bird Information</h3>
            <div className="af-line" />
          </div>

          <div className="af-form-grid">
            <div className="af-form-group">
              <label>Purchase Quantity <span className="af-req">*</span></label>
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

            <div className="af-form-group">
              <label>Current Birds</label>
              <input type="text" value={currentBirds || "—"} disabled readOnly />
              <small>Purchase Qty − Total Mortality (auto-computed later)</small>
            </div>

            <div className="af-form-group">
              <label>Mortality Rate</label>
              <input type="text" value={`${mortalityRate}%`} disabled readOnly />
              <small>(Total Mortality ÷ Purchase Qty) × 100</small>
            </div>

            <div className="af-form-group">
              <label>Age (Days)</label>
              <input type="text" value={ageDisplay || "—"} disabled readOnly />
              <small>Starts at 16 weeks on arrival; auto-computed from Date Acquired</small>
            </div>
          </div>

          {/* ADDITIONAL INFORMATION */}
          <div className="af-section-header">
            <FiFileText />
            <h3>Additional Information</h3>
            <div className="af-line" />
          </div>

          <div className="af-form-group af-full-width">
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
          <div className="af-form-actions">
            <p className="af-req-note">Fields with * are required.</p>
            <div className="af-action-btns">
              <button type="button" className="af-cancel-btn" onClick={() => navigate("/records/flock")}>
                <FiX /> Cancel
              </button>
              <button type="submit" className="af-save-btn">
                <FiSave /> Save Flock Record
              </button>
            </div>
          </div>
        </form>
    </PageLayout>
  );
}