import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiInfo, FiGrid, FiFileText, FiBarChart2, FiSave, FiX,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditEggRecord.css";
import { getEggRecord, updateEggRecord } from "../api/eggRecord";
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

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

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
  const today = localToday();

  const [formData, setFormData] = useState({
    batchId: "",
    currentQuantity: "",
    collectionDate: "",
    peewee: "", small: "", medium: "", large: "", extraLarge: "", jumbo: "",
    crackedEggs: "",
    remarks: "",
  });
  const [originalBatchId, setOriginalBatchId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [flocks, setFlocks]   = useState([]);

  useEffect(() => {
    listFlocks()
      .then((data) => setFlocks(Array.isArray(data) ? data : data.records || data.flocks || []))
      .catch(() => setFlocks([]));
  }, []);

  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const data = await getEggRecord(id);
        const r = data.record || data.data || data;
        if (r) {
          setFormData((prev) => ({
            ...prev,
            batchId:         r.batchId || "",
            currentQuantity: r.birdsAtCollection ?? "",
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
          setOriginalBatchId(r.batchId || "");
        } else {
          setError("Record not found.");
        }
      } catch (err) {
        setError(err?.message || "Cannot connect to server. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id]);

  const selectedFlock = flocks.find((f) => f.batchId === formData.batchId);

  const eligibleFlocks = flocks.filter((f) => f.status === "Active" || f.batchId === originalBatchId);
  const batchOptions = [...new Set(eligibleFlocks.map((f) => f.batchId).filter(Boolean))];

  const num = (v) => parseInt(v, 10) || 0;

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

  const handleBatchChange = (e) => {
    const batchId = e.target.value;
    const flock = flocks.find((f) => f.batchId === batchId);
    setFormData((prev) => ({
      ...prev,
      batchId,
      currentQuantity: flock?.currentQuantity ?? prev.currentQuantity,
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
      await updateEggRecord(id, {
        ...formData, goodEggs, totalEggs,
        henDayPercent: henDayRate == null ? null : henDayRate,
        productionStatus: status?.label ?? null,
      });
      setSuccess("Egg record updated successfully!");
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch {}
      setTimeout(() => navigate("/records/egg"), 1200);
    } catch (err) {
      setError(err?.message || "Cannot connect to server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageLayout
        background="#f4f4f2"
        breadcrumbItems={[
          { label: "RECORDS", path: "/records" },
          { label: "EGG RECORD", path: "/records/egg" },
          { label: "EDIT EGG RECORD" },
        ]}
      >
        <p className="pb-loading-text">Loading egg record...</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        { label: "RECORDS", path: "/records" },
        { label: "EGG RECORD", path: "/records/egg" },
        { label: "EDIT EGG RECORD" },
      ]}
    >
        {success && <div className="eer-success-banner">{success}</div>}
        {error   && <div className="eer-error-banner">{error}</div>}

        <form className="eer-form-card" onSubmit={handleSubmit}>

          <div className="eer-section-header">
            <FiInfo />
            <h3>Batch Information</h3>
            <div className="eer-line" />
          </div>

          <div className="eer-form-grid">
            <div className="eer-form-group">
              <label>Batch <span className="eer-req">*</span></label>
              <select name="batchId" value={formData.batchId} onChange={handleBatchChange} required>
                <option value="">Select Batch</option>
                {formData.batchId && !batchOptions.includes(formData.batchId) && (
                  <option value={formData.batchId}>{formData.batchId}</option>
                )}
                {batchOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <small>Only Active batches are eligible for a new assignment.</small>
            </div>

            <div className="eer-form-group">
              <label> Date <span className="eer-req">*</span></label>
              <input type="date" name="collectionDate" value={formData.collectionDate} onChange={handleChange} max={today} required />
              <small>Date the eggs were collected.</small>
            </div>
          </div>

          <div className="eer-section-header">
            <FiGrid />
            <h3>Egg Collection</h3>
            <div className="eer-line" />
          </div>

          <div className="eer-count-grid">
            {COUNT_FIELDS.map((f) => (
              <div className="eer-form-group" key={f.name}>
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
            <div className="eer-error-banner">
              Total eggs: {totalEggs}. Current chickens: {currentBirds}. Please reduce the egg quantities.
            </div>
          )}

          <div className="eer-section-header">
            <FiFileText />
            <h3>Additional Information</h3>
            <div className="eer-line" />
          </div>

          <div className="eer-form-group eer-full-width">
            <label>Remarks <span style={{ color: "#a39e94", fontWeight: 400 }}>(optional)</span></label>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange}
              placeholder="Enter remarks or observations..." maxLength={500} />
            <small className="eer-char-count">{(formData.remarks || "").length} / 500</small>
          </div>

          <div className="eer-section-header">
            <FiBarChart2 />
            <h3>Production Summary</h3>
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
              <div className="eer-result-value" style={eggTotalExceeded ? { color: "#d94f4f" } : undefined}>{totalEggs}</div>
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
                    {status.label}
                  </span>
                ) : "--"}
              </div>
              <p>Based on Hen-Day %</p>
            </div>
          </div>

          <div className="eer-form-actions">
            <p className="eer-req-note">Fields with * are required.</p>
            <div className="eer-action-btns">
              <button type="button" className="eer-cancel-btn" onClick={() => navigate("/records/egg")} disabled={saving}>
                <FiX /> Cancel
              </button>
              <button type="submit" className="eer-save-btn" disabled={saving || eggTotalExceeded}>
                <FiSave /> {saving ? "Saving..." : "Update Record"}
              </button>
            </div>
          </div>

        </form>

    </PageLayout>
  );
}