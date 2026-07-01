import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiInfo, FiGrid, FiFileText, FiBarChart2, FiSave, FiMenu,
} from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./EditEggRecord.css";

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

function productionStatus(rate) {
  if (rate == null) return null;
  if (rate >= 95) return { label: "Excellent", dot: "🟢", color: "#2e9e6b", bg: "#eaf7f1" };
  if (rate >= 90) return { label: "Good",      dot: "🟢", color: "#2e9e6b", bg: "#eaf7f1" };
  if (rate >= 80) return { label: "Monitor",   dot: "🟡", color: "#c8930c", bg: "#fdf3e3" };
  return            { label: "Critical",  dot: "🔴", color: "#d94f4f", bg: "#fdf0f0" };
}

export default function EditEggRecord() {
  const navigate = useNavigate();
  const { id }   = useParams();

  const [formData, setFormData] = useState({
    batchId: "",
    cageId: "",
    currentQuantity: "",
    collectionDate: "",
    peewee: "", small: "", medium: "", large: "", extraLarge: "", jumbo: "",
    crackedEggs: "",
    remarks: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [flocks, setFlocks]   = useState([]);

  // Flocks (Batch + Cage dropdowns)
  useEffect(() => {
    fetch(FLOCKS_API)
      .then((r) => r.json())
      .then((data) => setFlocks(Array.isArray(data) ? data : data.records || data.flocks || []))
      .catch(() => setFlocks([]));
  }, []);

  // Fetch existing record
  useEffect(() => {
    const fetchRecord = async () => {
      try {
        const res  = await fetch(`${API_BASE}/${id}`);
        const data = await res.json();
        const r = data.record || data.data;
        if (r) {
          setFormData((prev) => ({
            ...prev,
            batchId:         r.batchId || "",
            cageId:          r.cageId || "",
            currentQuantity: r.currentQuantity ?? "",
            collectionDate:  r.collectionDate?.split("T")[0] || "",
            peewee:          r.peewee ?? "",
            small:           r.small ?? "",
            medium:          r.medium ?? "",
            large:           r.large ?? "",
            extraLarge:      r.extraLarge ?? "",
            jumbo:           r.jumbo ?? "",
            crackedEggs:     r.crackedEggs ?? "",
            remarks:         r.remarks ?? "",
          }));
        } else {
          setError(data.message || "Failed to load record.");
        }
      } catch {
        setError("Cannot connect to server. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id]);

  const selectedFlock = flocks.find((f) => f.batchId === formData.batchId);
  const batchOptions = [...new Set(flocks.map((f) => f.batchId).filter(Boolean))];
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

  const handleBatchChange = (e) => {
    const batchId = e.target.value;
    const flock = flocks.find((f) => f.batchId === batchId);
    setFormData((prev) => ({
      ...prev,
      batchId,
      cageId: "",
      currentQuantity: flock?.currentQuantity ?? prev.currentQuantity,
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData, goodEggs, totalEggs,
          henDayPercent: henDayRate == null ? null : henDayRate,
          productionStatus: status?.label ?? null,
        }),
      });
      const data = await res.json();
      if (data.success !== false) {
        setSuccess("Egg record updated successfully!");
        setTimeout(() => navigate("/records/egg"), 1200);
      } else {
        setError(data.message || "Failed to update record.");
      }
    } catch {
      setError("Cannot connect to server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="eer-page">
      <Sidebar />

      <div className="eer-main">

        {/* Breadcrumb */}
        <div className="eer-breadcrumb">
          <button className="eer-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="eer-breadcrumb-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span>›</span>
          <span className="eer-breadcrumb-link" onClick={() => navigate("/records/egg")}>EGG RECORD</span>
          <span>›</span>
          <span className="eer-breadcrumb-current">EDIT EGG RECORD</span>
        </div>

        {/* Header */}
        <div className="eer-header">
          <div>
            <h2>Edit Egg Record</h2>
            <p>Update this egg collection. Good Eggs, Total Eggs, Hen-Day %, and Production Status are computed automatically.</p>
          </div>
        </div>

        {/* Banners */}
        {success && <div className="eer-success-banner">{success}</div>}
        {error   && <div className="eer-error-banner">{error}</div>}

        {loading ? (
          <div className="eer-loading">Loading egg record...</div>
        ) : (
          <form className="eer-form-card" onSubmit={handleSubmit}>

            {/* BATCH INFORMATION */}
            <div className="eer-section-header">
              <FiInfo />
              <h3>BATCH INFORMATION</h3>
              <div className="eer-line" />
            </div>

            <div className="eer-form-grid">
              <div className="eer-form-group">
                <label>Batch <span className="req">*</span></label>
                <select name="batchId" value={formData.batchId} onChange={handleBatchChange} required>
                  <option value="">Select Batch</option>
                  {formData.batchId && !batchOptions.includes(formData.batchId) && (
                    <option value={formData.batchId}>{formData.batchId}</option>
                  )}
                  {batchOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <small>Select the flock batch for this collection.</small>
              </div>

              <div className="eer-form-group">
                <label>Cage <span className="req">*</span></label>
                <select name="cageId" value={formData.cageId} onChange={handleChange} required>
                  <option value="">Select Cage</option>
                  {formData.cageId && !cageOptions.includes(formData.cageId) && (
                    <option value={formData.cageId}>{formData.cageId}</option>
                  )}
                  {cageOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <small>Select a cage (C-01 to C-12).</small>
              </div>

              <div className="eer-form-group">
                <label>Collection Date <span className="req">*</span></label>
                <input type="date" name="collectionDate" value={formData.collectionDate} onChange={handleChange} required />
                <small>Date the eggs were collected.</small>
              </div>
            </div>

            {/* EGG COLLECTION */}
            <div className="eer-section-header">
              <FiGrid />
              <h3>EGG COLLECTION</h3>
              <div className="eer-line" />
            </div>

            <div className="eer-count-grid">
              {COUNT_FIELDS.map((f) => (
                <div className="eer-form-group" key={f.name}>
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
            <div className="eer-section-header">
              <FiFileText />
              <h3>ADDITIONAL INFORMATION</h3>
              <div className="eer-line" />
            </div>

            <div className="eer-form-grid">
              <div className="eer-form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Remarks <span style={{ color: "#a39e94", fontWeight: 400 }}>(optional)</span></label>
                <textarea name="remarks" value={formData.remarks} onChange={handleChange}
                  placeholder="Enter remarks or observations..." rows="3" maxLength={500} />
              </div>
            </div>

            {/* PRODUCTION SUMMARY (read-only) */}
            <div className="eer-section-header">
              <FiBarChart2 />
              <h3>PRODUCTION SUMMARY</h3>
              <div className="eer-line" />
            </div>

            <div className="eer-result-grid">
              <div className="eer-result-card">
                <h4>Current Birds</h4>
                <div className="eer-result-value">{currentBirds == null ? "--" : currentBirds}</div>
                <p>From selected batch</p>
              </div>

              <div className="eer-result-card">
                <h4>Good Eggs</h4>
                <div className="eer-result-value">{goodEggs}</div>
                <p>Sum of all egg sizes</p>
              </div>

              <div className="eer-result-card">
                <h4>Total Eggs</h4>
                <div className="eer-result-value">{totalEggs}</div>
                <p>Good Eggs + Cracked Eggs</p>
              </div>

              <div className="eer-result-card">
                <h4>Hen-Day Production</h4>
                <div className="eer-result-value green">{henDayDisplay}</div>
                <p>( Total Eggs / Current Birds ) × 100</p>
              </div>

              <div className="eer-result-card">
                <h4>Production Status</h4>
                <div className="eer-result-value" style={{ fontSize: "1rem" }}>
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

            <div className="eer-info-box">
              <p>Current Birds, Good Eggs, Total Eggs, Hen-Day %, and Production Status update automatically and are read-only.</p>
            </div>

            {/* Actions */}
            <div className="eer-form-actions">
              <button type="button" className="eer-cancel-btn" onClick={() => navigate("/records/egg")} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="eer-save-btn" disabled={saving}>
                <FiSave />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  );
}