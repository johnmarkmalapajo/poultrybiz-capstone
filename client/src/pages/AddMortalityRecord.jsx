import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiSave, FiX, FiMenu, FiHeart, FiFileText, FiActivity, FiAlertTriangle } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./AddMortalityRecord.css";

const FLOCKS_API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/flocks`;
const MORT_API   = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/mortality-records`;

const CHICKENS_PER_CAGE = 4; // each cage (room) holds 4 chickens
const CAUSES = ["Disease", "Stress", "Dehydration", "Accident", "Unknown", "Others"];
const CAGES = Array.from({ length: 12 }, (_, i) => `C-${String(i + 1).padStart(2, "0")}`);

const flockCages = (f) => f.assignedCages || (f.cageId ? [f.cageId] : []);

export default function AddMortalityRecord() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    date: "",
    batchId: "",
    cageId: "",
    numberOfMortality: "",
    causeOfDeath: "",
    suspectedDisease: "",
    remarks: "",
  });

  const [flocks, setFlocks] = useState([]);
  const [mortRecords, setMortRecords] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(FLOCKS_API)
      .then((r) => r.json())
      .then((d) => setFlocks(Array.isArray(d) ? d : d.records || d.flocks || []))
      .catch(() => setFlocks([]));

    fetch(MORT_API)
      .then((r) => r.json())
      .then((d) => setMortRecords(Array.isArray(d) ? d : d.records || d.data || []))
      .catch(() => setMortRecords([]));
  }, []);

  const batchOptions = [...new Set(flocks.map((f) => f.batchId).filter(Boolean))];
  const selectedFlock = flocks.find((f) => f.batchId === formData.batchId);
  const cageOptions = CAGES;

  // ── Per-batch totals (Current Birds + Mortality Rate) ──
  const purchaseQty = Number(selectedFlock?.quantityPurchased) || 0;
  const batchMortality = mortRecords
    .filter((r) => r.batchId === formData.batchId)
    .reduce((s, r) => s + (Number(r.numberOfMortality) || 0), 0);
  const currentBirds = Math.max(0, purchaseQty - batchMortality);
  const mortalityRate = purchaseQty > 0 ? ((batchMortality / purchaseQty) * 100).toFixed(2) : "0.00";

  // ── Per-cage current birds (cap = 4 − prior deaths in that cage) ──
  const cagePriorDeaths = mortRecords
    .filter((r) => r.batchId === formData.batchId && r.cageId === formData.cageId)
    .reduce((s, r) => s + (Number(r.numberOfMortality) || 0), 0);
  const cageCurrentBirds = formData.cageId ? Math.max(0, CHICKENS_PER_CAGE - cagePriorDeaths) : null;

  // ── Duplicate check (Batch + Cage + Date) ──
  const isDuplicate =
    formData.batchId && formData.cageId && formData.date &&
    mortRecords.some(
      (r) => r.batchId === formData.batchId && r.cageId === formData.cageId && r.date === formData.date
    );

  const isDisease = formData.causeOfDeath === "Disease";
  const numDead = Number(formData.numberOfMortality) || 0;
  const exceedsCage = cageCurrentBirds != null && numDead > cageCurrentBirds;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      // reset cage when batch changes
      if (name === "batchId") return { ...prev, batchId: value, cageId: "" };
      return { ...prev, [name]: value };
    });
    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (numDead < 0) return setError("Number of dead chickens cannot be negative.");
    if (numDead < 1) return setError("Enter at least 1 dead chicken.");
    if (isDuplicate)
      return setError("A mortality record already exists for this Batch + Cage + Date.");
    if (exceedsCage)
      return setError(`Number of dead chickens (${numDead}) exceeds current birds in cage ${formData.cageId} (${cageCurrentBirds}).`);

    const payload = {
      ...formData,
      numberOfMortality: numDead,
      currentBirds,
      mortalityRate: Number(mortalityRate),
    };
    console.log("Mortality payload:", payload);
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
            <p>Log a bird mortality event for a specific batch and cage, including the number that died, the cause, and any observations.</p>
          </div>
        </div>

        <form className="amr-form-card" onSubmit={handleSubmit}>

          {error && (
            <div style={{ background: "#fdf0f0", color: "#c0392b", border: "1.5px solid #f5c6c6",
              borderRadius: "8px", padding: "10px 14px", fontSize: "13px", fontWeight: 600 }}>
              {error}
            </div>
          )}

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
                {batchOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div className="amr-form-group">
              <label>Cage <span className="amr-req">*</span></label>
              <select name="cageId" value={formData.cageId} onChange={handleChange} required>
                <option value="">Select Cage</option>
                {cageOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              {formData.cageId && (
                <small>Current birds in this cage: {cageCurrentBirds}</small>
              )}
            </div>

            <div className="amr-form-group">
              <label>Number of Mortality <span className="amr-req">*</span></label>
              <input type="number" min="0" max={cageCurrentBirds ?? undefined}
                name="numberOfMortality"
                value={formData.numberOfMortality} onChange={handleChange}
                placeholder="Enter number of mortality" required />
              {exceedsCage && (
                <small style={{ color: "#c0392b" }}>Cannot exceed {cageCurrentBirds} (current birds in cage).</small>
              )}
            </div>

            <div className="amr-form-group">
              <label>Cause of Death <span className="amr-req">*</span></label>
              <select name="causeOfDeath" value={formData.causeOfDeath} onChange={handleChange} required>
                <option value="">Select cause</option>
                {CAUSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="amr-form-group">
              <label>Suspected Disease <span style={{ color: "#a39e94", fontWeight: 400 }}>(optional)</span></label>
              <input type="text" name="suspectedDisease"
                value={formData.suspectedDisease} onChange={handleChange}
                placeholder="e.g. Newcastle, Coccidiosis" />
            </div>
          </div>

          {/* Duplicate warning */}
          {isDuplicate && (
            <div style={{ background: "#fff8e1", color: "#856404", border: "1.5px solid #ffe08a",
              borderRadius: "8px", padding: "10px 14px", fontSize: "13px", fontWeight: 600,
              display: "flex", alignItems: "center", gap: "8px" }}>
              <FiAlertTriangle /> A record already exists for this Batch + Cage + Date.
            </div>
          )}

          {/* Disease → Critical Health Alert (UI notice) */}
          {isDisease && (
            <div style={{ background: "#fdf0f0", color: "#c0392b", border: "1.5px solid #f5c6c6",
              borderRadius: "8px", padding: "10px 14px", fontSize: "13px", fontWeight: 600,
              display: "flex", alignItems: "center", gap: "8px" }}>
              <FiAlertTriangle /> Critical Health Alert: Disease-related mortality. Immediate veterinary consultation is recommended.
            </div>
          )}

          {/* ADDITIONAL INFORMATION */}
          <div className="amr-section-header">
            <FiFileText />
            <h3>Additional Information</h3>
            <div className="amr-line" />
          </div>

          <div className="amr-form-group amr-full-width">
            <label>Remarks</label>
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
              <button type="submit" className="amr-save-btn" disabled={isDuplicate || exceedsCage}>
                <FiSave /> Save Record
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}