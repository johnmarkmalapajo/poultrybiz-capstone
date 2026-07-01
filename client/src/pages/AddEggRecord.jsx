import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiInfo, FiGrid, FiFileText, FiBarChart2, FiSave, FiMenu,
} from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./AddEggRecord.css";

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/egg-records`;
const FLOCKS_API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/flocks`;

const SIZE_FIELDS = [
  { name: "peewee",     label: "Peewee" },
  { name: "small",      label: "Small" },
  { name: "medium",     label: "Medium" },
  { name: "large",      label: "Large" },
  { name: "extraLarge", label: "Extra Large" },
  { name: "jumbo",      label: "Jumbo" },
];
const COUNT_FIELDS = [...SIZE_FIELDS, { name: "crackedEggs", label: "Cracked Eggs" }];

// Fixed list of 12 cages (C-01 … C-12)
const CAGES = Array.from({ length: 12 }, (_, i) => `C-${String(i + 1).padStart(2, "0")}`);

const flockCages = (f) => f?.assignedCages || (f?.cageId ? [f.cageId] : []);

// Production status badge from Hen-Day %
function productionStatus(rate) {
  if (rate == null) return null;
  if (rate >= 95) return { label: "Excellent", dot: "🟢", color: "#2e9e6b", bg: "#eaf7f1" };
  if (rate >= 90) return { label: "Good",      dot: "🟢", color: "#2e9e6b", bg: "#eaf7f1" };
  if (rate >= 80) return { label: "Monitor",   dot: "🟡", color: "#c8930c", bg: "#fdf3e3" };
  return            { label: "Critical",  dot: "🔴", color: "#d94f4f", bg: "#fdf0f0" };
}

export default function AddEggRecord() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    batchId: "",
    cageId: "",
    currentQuantity: "",
    collectionDate: new Date().toISOString().split("T")[0],
    peewee: "", small: "", medium: "", large: "", extraLarge: "", jumbo: "",
    crackedEggs: "",
    remarks: "",
  });

  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [flocks, setFlocks]   = useState([]);

  useEffect(() => {
    fetch(FLOCKS_API)
      .then((r) => r.json())
      .then((data) => setFlocks(Array.isArray(data) ? data : data.records || data.flocks || []))
      .catch(() => setFlocks([]));
  }, []);

  const batchOptions = [...new Set(flocks.map((f) => f.batchId).filter(Boolean))];
  const selectedFlock = flocks.find((f) => f.batchId === formData.batchId);
  const cageOptions = CAGES;

  const num = (v) => parseInt(v, 10) || 0;

  // ── Frontend computations ──
  const goodEggs =
    num(formData.peewee) + num(formData.small) + num(formData.medium) +
    num(formData.large) + num(formData.extraLarge) + num(formData.jumbo);
  const totalEggs = goodEggs + num(formData.crackedEggs);

  const currentBirds = formData.currentQuantity !== "" ? num(formData.currentQuantity) : null;
  const henDayRate =
    currentBirds && currentBirds > 0
      ? Math.round((totalEggs / currentBirds) * 100 * 100) / 100
      : null;
  const henDayDisplay = henDayRate == null ? "--" : `${henDayRate.toFixed(2)}%`;
  const status = productionStatus(henDayRate);

  // whole-number-only handler for egg counts
  const handleCountChange = (e) => {
    const { name, value } = e.target;
    if (value === "") return setFormData((p) => ({ ...p, [name]: "" }));
    const n = Math.max(0, Math.floor(Number(value)));
    if (Number.isNaN(n)) return;
    setFormData((p) => ({ ...p, [name]: String(n) }));
    setError("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  // Selecting a batch auto-fills cage + current birds; resets cage
  const handleBatchChange = (e) => {
    const batchId = e.target.value;
    const flock = flocks.find((f) => f.batchId === batchId);
    setFormData((prev) => ({
      ...prev,
      batchId,
      cageId: "",
      currentQuantity: flock?.currentQuantity ?? "",
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData, goodEggs, totalEggs,
          henDayPercent: henDayRate == null ? null : henDayRate,
          productionStatus: status?.label ?? null,
        }),
      });
      const data = await res.json();
      if (data.success !== false) {
        setSuccess("Egg record saved successfully!");
        setTimeout(() => navigate("/records/egg"), 1200);
      } else {
        setError(data.message || "Failed to save record.");
      }
    } catch {
      setError("Cannot connect to server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="aer-page">
      <Sidebar />

      <div className="aer-main">

        {/* Breadcrumb */}
        <div className="aer-breadcrumb">
          <button className="aer-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="aer-breadcrumb-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span>›</span>
          <span className="aer-breadcrumb-link" onClick={() => navigate("/records/egg")}>EGG RECORD</span>
          <span>›</span>
          <span className="aer-breadcrumb-current">ADD EGG RECORD</span>
        </div>

        {/* Header */}
        <div className="aer-header">
          <div>
            <h2>Add Egg Record</h2>
            <p>Log a daily egg collection. Good Eggs, Total Eggs, Hen-Day %, and Production Status are computed automatically.</p>
          </div>
        </div>

        {/* Banners */}
        {success && <div className="aer-success-banner">{success}</div>}
        {error   && <div className="aer-error-banner">{error}</div>}

        <form className="aer-form-card" onSubmit={handleSubmit}>

          {/* BATCH INFORMATION */}
          <div className="aer-section-header">
            <FiInfo />
            <h3>BATCH INFORMATION</h3>
            <div className="aer-line" />
          </div>

          <div className="aer-form-grid">
            <div className="aer-form-group">
              <label>Batch <span className="req">*</span></label>
              <select name="batchId" value={formData.batchId} onChange={handleBatchChange} required>
                <option value="">Select Batch</option>
                {batchOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <small>Select the flock batch for this collection.</small>
            </div>

            <div className="aer-form-group">
              <label>Cage <span className="req">*</span></label>
              <select name="cageId" value={formData.cageId} onChange={handleChange} required>
                <option value="">Select Cage</option>
                {cageOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <small>Select a cage (C-01 to C-12).</small>
            </div>

            <div className="aer-form-group">
              <label>Collection Date <span className="req">*</span></label>
              <input type="date" name="collectionDate" value={formData.collectionDate} onChange={handleChange} required />
              <small>Date the eggs were collected.</small>
            </div>
          </div>

          {/* EGG COLLECTION */}
          <div className="aer-section-header">
            <FiGrid />
            <h3>EGG COLLECTION</h3>
            <div className="aer-line" />
          </div>

          <div className="aer-count-grid">
            {COUNT_FIELDS.map((f) => (
              <div className="aer-form-group" key={f.name}>
                <label>{f.label}</label>
                <input
                  type="number" min="0" step="1" name={f.name}
                  value={formData[f.name]} onChange={handleCountChange}
                  onKeyDown={(e) => ["-", "e", "E", "."].includes(e.key) && e.preventDefault()}
                  placeholder="0"
                />
              </div>
            ))}
          </div>

          {/* ADDITIONAL INFORMATION */}
          <div className="aer-section-header">
            <FiFileText />
            <h3>ADDITIONAL INFORMATION</h3>
            <div className="aer-line" />
          </div>

          <div className="aer-form-grid">
            <div className="aer-form-group" style={{ gridColumn: "1 / -1" }}>
              <label>Remarks <span style={{ color: "#a39e94", fontWeight: 400 }}>(optional)</span></label>
              <textarea name="remarks" value={formData.remarks} onChange={handleChange}
                placeholder="Enter remarks or observations..." rows="3" maxLength={500} />
            </div>
          </div>

          {/* PRODUCTION SUMMARY (read-only) */}
          <div className="aer-section-header">
            <FiBarChart2 />
            <h3>PRODUCTION SUMMARY</h3>
            <div className="aer-line" />
          </div>

          <div className="aer-result-grid">
            <div className="aer-result-card">
              <h4>Current Birds</h4>
              <div className="aer-result-value">{currentBirds == null ? "--" : currentBirds}</div>
              <p>From selected batch</p>
            </div>

            <div className="aer-result-card">
              <h4>Good Eggs</h4>
              <div className="aer-result-value">{goodEggs}</div>
              <p>Sum of all egg sizes</p>
            </div>

            <div className="aer-result-card">
              <h4>Total Eggs</h4>
              <div className="aer-result-value">{totalEggs}</div>
              <p>Good Eggs + Cracked Eggs</p>
            </div>

            <div className="aer-result-card">
              <h4>Hen-Day Production</h4>
              <div className="aer-result-value green">{henDayDisplay}</div>
              <p>( Total Eggs / Current Birds ) × 100</p>
            </div>

            <div className="aer-result-card">
              <h4>Production Status</h4>
              <div className="aer-result-value" style={{ fontSize: "1rem" }}>
                {status ? (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    background: status.bg, color: status.color,
                    padding: "4px 12px", borderRadius: "999px", fontWeight: 700, fontSize: "0.85rem",
                  }}>
                    {status.dot} {status.label}
                  </span>
                ) : "--"}
              </div>
              <p>Based on Hen-Day %</p>
            </div>
          </div>

          <div className="aer-info-box">
            <p>Current Birds, Good Eggs, Total Eggs, Hen-Day %, and Production Status update automatically and are read-only.</p>
          </div>

          {/* Actions */}
          <div className="aer-form-actions">
            <button type="button" className="aer-cancel-btn" onClick={() => navigate("/records/egg")} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="aer-save-btn" disabled={saving}>
              <FiSave />
              {saving ? "Saving..." : "Save Egg Record"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}