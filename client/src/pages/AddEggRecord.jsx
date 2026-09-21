import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiInfo, FiGrid, FiFileText, FiBarChart2, FiSave, FiX,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./AddEggRecord.css";
import { createEggRecord } from "../api/eggRecord";
import { listFlocks } from "../api/flockProfile";

const SIZE_FIELDS = [
  { name: "peewee",     label: "Peewee" },
  { name: "small",      label: "Small" },
  { name: "medium",     label: "Medium" },
  { name: "large",      label: "Large" },
  { name: "extraLarge", label: "Extra Large" },
  { name: "jumbo",      label: "Jumbo" },
];
const COUNT_FIELDS = [...SIZE_FIELDS, { name: "crackedEggs", label: "Cracked Eggs" }];

// Local calendar date, not UTC -- toISOString() reports the wrong day
// during early-morning hours in timezones ahead of UTC (e.g. PH).
const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

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
  const today = localToday();

  const [formData, setFormData] = useState({
    batchId: "",
    currentQuantity: "",
    collectionDate: today,
    peewee: "", small: "", medium: "", large: "", extraLarge: "", jumbo: "",
    crackedEggs: "",
    remarks: "",
  });

  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [flocks, setFlocks]   = useState([]);

  useEffect(() => {
    listFlocks()
      .then((data) => setFlocks(Array.isArray(data) ? data : data.records || data.flocks || []))
      .catch(() => setFlocks([]));
  }, []);

  // Only Active flocks are eligible for a new Egg Record -- Culled is
  // terminal, and Quarantined always means "still under Ongoing
  // Quarantine" (Flock.status only becomes Active again through the
  // Quarantine Release workflow, so this one check always stays in
  // sync without needing a separate Quarantine lookup).
  const eligibleFlocks = flocks.filter((f) => f.status === "Active");
  const batchOptions = [...new Set(eligibleFlocks.map((f) => f.batchId).filter(Boolean))];

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

  const eggTotalExceeded = currentBirds != null && totalEggs > currentBirds;

  // Whole-number-only handler for egg counts -- rejects anything that
  // isn't plain digits (so "1e5", "1.5", "-3" etc. never get through),
  // rather than parsing first and clamping after, which would silently
  // accept scientific notation as a large number.
  const handleCountChange = (e) => {
    const { name, value } = e.target;
    if (value === "") return setFormData((p) => ({ ...p, [name]: "" }));
    if (!/^\d+$/.test(value)) return;
    setFormData((p) => ({ ...p, [name]: value }));
    setError("");
  };

  const handleCountPaste = (e) => {
    const text = e.clipboardData.getData("text");
    if (!/^\d+$/.test(text)) e.preventDefault();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  // Selecting a batch auto-fills current birds
  const handleBatchChange = (e) => {
    const batchId = e.target.value;
    const flock = flocks.find((f) => f.batchId === batchId);
    setFormData((prev) => ({
      ...prev,
      batchId,
      currentQuantity: flock?.currentQuantity ?? "",
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (formData.collectionDate > today) {
      setError("Collection Date cannot be a future date.");
      return;
    }
    if (eggTotalExceeded) {
      setError(`Total eggs: ${totalEggs}. Current chickens: ${currentBirds}. Please reduce the egg quantities.`);
      return;
    }

    setSaving(true); setError(""); setSuccess("");
    try {
      await createEggRecord({
        ...formData, goodEggs, totalEggs,
        henDayPercent: henDayRate == null ? null : henDayRate,
        productionStatus: status?.label ?? null,
      });
      setSuccess("Egg record saved successfully!");
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { /* ignore */ }
      setTimeout(() => navigate("/records/egg"), 1200);
    } catch (err) {
      setError(err?.message || "Cannot connect to server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        { label: "RECORDS", path: "/records" },
        { label: "EGG RECORD", path: "/records/egg" },
        { label: "ADD EGG RECORD" },
      ]}
    >
        {/* Banners */}
        {success && <div className="aer-success-banner">{success}</div>}
        {error   && <div className="aer-error-banner">{error}</div>}

        <form className="aer-form-card" onSubmit={handleSubmit}>

          {/* BATCH INFORMATION */}
          <div className="aer-section-header">
            <FiInfo />
            <h3>Batch Information</h3>
            <div className="aer-line" />
          </div>

          <div className="aer-form-grid">
            <div className="aer-form-group">
              <label>Batch <span className="aer-req">*</span></label>
              <select name="batchId" value={formData.batchId} onChange={handleBatchChange} required>
                <option value="">Select Batch</option>
                {batchOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <small>Only Active batches are eligible for Egg Record.</small>
            </div>

            <div className="aer-form-group">
              <label> Date <span className="aer-req">*</span></label>
              <input type="date" name="collectionDate" value={formData.collectionDate} onChange={handleChange} max={today} required />
            </div>
          </div>

          {/* EGG COLLECTION */}
          <div className="aer-section-header">
            <FiGrid />
            <h3>Egg Collection</h3>
            <div className="aer-line" />
          </div>

          <div className="aer-count-grid">
            {COUNT_FIELDS.map((f) => (
              <div className="aer-form-group" key={f.name}>
                <label>{f.label}</label>
                <input
                  type="text" inputMode="numeric" name={f.name}
                  value={formData[f.name]} onChange={handleCountChange}
                  onPaste={handleCountPaste}
                  onKeyDown={(e) => ["-", "+", "e", "E", "."].includes(e.key) && e.preventDefault()}
                  placeholder="0"
                />
              </div>
            ))}
          </div>

          {eggTotalExceeded && (
            <div className="aer-error-banner">
              Total eggs: {totalEggs}. Current chickens: {currentBirds}. Please reduce the egg quantities.
            </div>
          )}

          {/* ADDITIONAL INFORMATION */}
          <div className="aer-section-header">
            <FiFileText />
            <h3>Additional Information</h3>
            <div className="aer-line" />
          </div>

          <div className="aer-form-group aer-full-width">
            <label>Remarks <span style={{ color: "#a39e94", fontWeight: 400 }}>(optional)</span></label>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange}
              placeholder="Enter remarks or observations..." maxLength={500} />
            <small className="aer-char-count">{formData.remarks.length} / 500</small>
          </div>

          {/* PRODUCTION SUMMARY (read-only) */}
          <div className="aer-section-header">
            <FiBarChart2 />
            <h3>Production Summary</h3>
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
              <div className="aer-result-value" style={eggTotalExceeded ? { color: "#d94f4f" } : undefined}>{totalEggs}</div>
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
                    {status.label}
                  </span>
                ) : "--"}
              </div>
              <p>Based on Hen-Day %</p>
            </div>
          </div>


          {/* Actions */}
          <div className="aer-form-actions">
           
            <div className="aer-action-btns">
              <button type="button" className="aer-cancel-btn" onClick={() => navigate("/records/egg")} disabled={saving}>
                <FiX /> Cancel
              </button>
              <button type="submit" className="aer-save-btn" disabled={saving || eggTotalExceeded}>
                <FiSave /> {saving ? "Saving..." : "Save Record"}
              </button>
            </div>
          </div>

        </form>

    </PageLayout>
  );
}