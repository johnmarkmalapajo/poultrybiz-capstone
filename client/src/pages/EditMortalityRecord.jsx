import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiSave, FiX, FiMenu, FiHeart, FiFileText, FiActivity, FiAlertTriangle } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./EditMortalityRecord.css";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1");
const FLOCKS_API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/flocks`;
const MORT_API   = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/mortality-records`;

const CHICKENS_PER_CAGE = 4;
const CAUSES = ["Disease", "Stress", "Dehydration", "Accident", "Unknown", "Others"];
const CAGES = Array.from({ length: 12 }, (_, i) => `C-${String(i + 1).padStart(2, "0")}`);
const flockCages = (f) => f.assignedCages || (f.cageId ? [f.cageId] : []);

export default function EditMortalityRecord() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  // ── Fetch this record ──
  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/mortality-records/${id}`, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const rec = json.record || json.data || json;
        setFormData((prev) => ({ ...prev, ...rec }));
      } catch {
        // keep form
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Flocks + all mortality records (for cages, computed totals, duplicate check) ──
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

  const purchaseQty = Number(selectedFlock?.quantityPurchased) || 0;
  const batchMortality = mortRecords
    .filter((r) => r.batchId === formData.batchId)
    .reduce((s, r) => s + (Number(r.numberOfMortality) || 0), 0);
  const currentBirds = Math.max(0, purchaseQty - batchMortality);
  const mortalityRate = purchaseQty > 0 ? ((batchMortality / purchaseQty) * 100).toFixed(2) : "0.00";

  // per-cage current birds, excluding THIS record's own count
  const cagePriorDeaths = mortRecords
    .filter((r) => r._id !== id && r.batchId === formData.batchId && r.cageId === formData.cageId)
    .reduce((s, r) => s + (Number(r.numberOfMortality) || 0), 0);
  const cageCurrentBirds = formData.cageId ? Math.max(0, CHICKENS_PER_CAGE - cagePriorDeaths) : null;

  const isDuplicate =
    formData.batchId && formData.cageId && formData.date &&
    mortRecords.some(
      (r) => r._id !== id && r.batchId === formData.batchId && r.cageId === formData.cageId && r.date === formData.date
    );

  const isDisease = formData.causeOfDeath === "Disease";
  const numDead = Number(formData.numberOfMortality) || 0;
  const exceedsCage = cageCurrentBirds != null && numDead > cageCurrentBirds;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (name === "batchId") return { ...prev, batchId: value, cageId: "" };
      return { ...prev, [name]: value };
    });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (numDead < 0) return setError("Number of dead chickens cannot be negative.");
    if (numDead < 1) return setError("Enter at least 1 dead chicken.");
    if (isDuplicate) return setError("A mortality record already exists for this Batch + Cage + Date.");
    if (exceedsCage) return setError(`Number of dead chickens (${numDead}) exceeds current birds in cage ${formData.cageId} (${cageCurrentBirds}).`);

    try {
      const token = localStorage.getItem("token");
      setSaving(true);
      await fetch(`${API}/mortality-records/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...formData, numberOfMortality: numDead, currentBirds, mortalityRate: Number(mortalityRate) }),
      });
    } catch {
      setSaving(false);
      /* silent — adjust endpoint to your backend */
    }
    navigate("/records/mortality");
  };

  if (loading) {
    return (
      <div className="emr-page">
        <Sidebar />
        <div className="emr-main">
          <p style={{ color: "#aaa", fontFamily: "var(--font-body)" }}>Loading record...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="emr-page">
      <Sidebar />

      <div className="emr-main">

        {/* Breadcrumb */}
        <div className="emr-breadcrumb">
          <button className="emr-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="emr-bc-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span className="emr-bc-sep">›</span>
          <span className="emr-bc-link" onClick={() => navigate("/records/mortality")}>MORTALITY RECORD</span>
          <span className="emr-bc-sep">›</span>
          <span className="emr-bc-current">EDIT MORTALITY</span>
        </div>

        {/* Header */}

        <form className="emr-form-card" onSubmit={handleSubmit}>

          {error && (
            <div style={{ background: "#fdf0f0", color: "#c0392b", border: "1.5px solid #f5c6c6",
              borderRadius: "8px", padding: "10px 14px", fontSize: "13px", fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* MORTALITY DETAILS */}
          <div className="emr-section-header">
            <FiHeart />
            <h3>Mortality Details</h3>
            <div className="emr-line" />
          </div>

          <div className="emr-form-grid">
            <div className="emr-form-group">
              <label>Date <span className="emr-req">*</span></label>
              <input type="date" name="date" value={formData.date ? String(formData.date).slice(0,10) : ""} onChange={handleChange} required />
            </div>

            <div className="emr-form-group">
              <label>Batch ID <span className="emr-req">*</span></label>
              <select name="batchId" value={formData.batchId} onChange={handleChange} required>
                <option value="">Select batch ID</option>
                {formData.batchId && !batchOptions.includes(formData.batchId) && (
                  <option value={formData.batchId}>{formData.batchId}</option>
                )}
                {batchOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div className="emr-form-group">
              <label>Cage <span className="emr-req">*</span></label>
              <select name="cageId" value={formData.cageId} onChange={handleChange} required>
                <option value="">Select Cage</option>
                {formData.cageId && !cageOptions.includes(formData.cageId) && (
                  <option value={formData.cageId}>{formData.cageId}</option>
                )}
                {cageOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              {formData.cageId && <small>Current birds in this cage: {cageCurrentBirds}</small>}
            </div>

            <div className="emr-form-group">
              <label>Number of Mortality <span className="emr-req">*</span></label>
              <input type="number" min="0" max={cageCurrentBirds ?? undefined}
                name="numberOfMortality"
                value={formData.numberOfMortality} onChange={handleChange}
                placeholder="Enter number of mortality" required />
              {exceedsCage && (
                <small style={{ color: "#c0392b" }}>Cannot exceed {cageCurrentBirds} (current birds in cage).</small>
              )}
            </div>

            <div className="emr-form-group">
              <label>Cause of Death <span className="emr-req">*</span></label>
              <select name="causeOfDeath" value={formData.causeOfDeath} onChange={handleChange} required>
                <option value="">Select cause</option>
                {formData.causeOfDeath && !CAUSES.includes(formData.causeOfDeath) && (
                  <option value={formData.causeOfDeath}>{formData.causeOfDeath}</option>
                )}
                {CAUSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="emr-form-group">
              <label>Suspected Disease <span style={{ color: "#a39e94", fontWeight: 400 }}>(optional)</span></label>
              <input type="text" name="suspectedDisease"
                value={formData.suspectedDisease || ""} onChange={handleChange}
                placeholder="e.g. Newcastle, Coccidiosis" />
            </div>
          </div>

          {isDuplicate && (
            <div style={{ background: "#fff8e1", color: "#856404", border: "1.5px solid #ffe08a",
              borderRadius: "8px", padding: "10px 14px", fontSize: "13px", fontWeight: 600,
              display: "flex", alignItems: "center", gap: "8px" }}>
              <FiAlertTriangle /> A record already exists for this Batch + Cage + Date.
            </div>
          )}

          {isDisease && (
            <div style={{ background: "#fdf0f0", color: "#c0392b", border: "1.5px solid #f5c6c6",
              borderRadius: "8px", padding: "10px 14px", fontSize: "13px", fontWeight: 600,
              display: "flex", alignItems: "center", gap: "8px" }}>
              <FiAlertTriangle /> Critical Health Alert: Disease-related mortality. Immediate veterinary consultation is recommended.
            </div>
          )}

          {/* ADDITIONAL INFORMATION */}
          <div className="emr-section-header">
            <FiFileText />
            <h3>Additional Information</h3>
            <div className="emr-line" />
          </div>

          <div className="emr-form-group emr-full-width">
            <label>Remarks</label>
            <textarea name="remarks"
              value={formData.remarks || ""} onChange={handleChange}
              placeholder="Enter remarks or observations..." maxLength={500} />
            <small className="emr-char-count">{(formData.remarks || "").length} / 500</small>
          </div>

          {/* Actions */}
          <div className="emr-form-actions">
            <p className="emr-req-note">Fields with * are required.</p>
            <div className="emr-action-btns">
              <button type="button" className="emr-cancel-btn" onClick={() => navigate("/records/mortality")}>
                <FiX /> Cancel
              </button>
              <button type="submit" className="emr-save-btn" disabled={saving || isDuplicate || exceedsCage}>
                <FiSave /> Update Record
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
