import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiSave, FiX, FiHeart, FiFileText, FiActivity, FiAlertTriangle } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./AddMortalityRecord.css";
import { createMortalityRecord, listMortalityRecords } from "../api/mortalityRecord";
import { listFlocks } from "../api/flockProfile";
import { listQuarantineRecords } from "../api/quarantineIsolation";
import { listHealthOptions } from "../api/healthOptions";

const NEW_VALUE = "__new__";
const CAUSES = ["Disease", "Stress", "Dehydration", "Accident", "Unknown"];

export default function AddMortalityRecord() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    date: "",
    batchId: "",
    numberOfMortality: "",
    causeOfDeath: "",
    remarks: "",
  });

  const [flocks, setFlocks] = useState([]);
  const [isolationRecords, setIsolationRecords] = useState([]);
  const [mortRecords, setMortRecords] = useState([]);
  const [error, setError] = useState("");
  const [newCauseOfDeath, setNewCauseOfDeath] = useState("");
  const [causeOfDeathOptions, setCauseOfDeathOptions] = useState(CAUSES);

  useEffect(() => {
    listHealthOptions("causeOfDeath").then((r) => {
      const fetched = (r.options || []).map((o) => o.value);
      setCauseOfDeathOptions([...CAUSES, ...fetched.filter((v) => !CAUSES.includes(v))]);
    }).catch(() => setCauseOfDeathOptions(CAUSES));
  }, []);

  useEffect(() => {
    listFlocks()
      .then((d) => setFlocks(Array.isArray(d) ? d : d.records || d.flocks || []))
      .catch(() => setFlocks([]));

    listQuarantineRecords()
      .then((d) => setIsolationRecords((Array.isArray(d) ? d : d.records || d.data || []).filter((r) => r.recordType === "Isolation")))
      .catch(() => setIsolationRecords([]));

    listMortalityRecords()
      .then((d) => setMortRecords(Array.isArray(d) ? d : d.records || d.data || []))
      .catch(() => setMortRecords([]));
  }, []);

  const isolationBatchIds = new Set(isolationRecords.map((r) => r.batchId));
  const batchOptions = [...new Set(
    flocks
      .filter((f) => f.status === "Active" && !isolationBatchIds.has(f.batchId))
      .map((f) => f.batchId)
      .filter(Boolean)
  )];
  const selectedFlock = flocks.find((f) => f.batchId === formData.batchId);
  const nextMortalityId = (() => {
    let max = 0;
    mortRecords.forEach((r) => {
      const m = /^M-(\d+)$/.exec(r.mortalityId || "");
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `M-${String(max + 1).padStart(3, "0")}`;
  })();

  const purchaseQty = Number(selectedFlock?.quantityPurchased) || 0;
  const batchMortality = mortRecords
    .filter((r) => r.batchId === formData.batchId)
    .reduce((s, r) => s + (Number(r.numberOfMortality) || 0), 0);
  const currentBirds = Math.max(0, purchaseQty - batchMortality);
  const mortalityRate = purchaseQty > 0 ? ((batchMortality / purchaseQty) * 100).toFixed(2) : "0.00";

  const isDuplicate =
    formData.batchId && formData.date &&
    mortRecords.some(
      (r) => r.batchId === formData.batchId && r.date === formData.date
    );

  const isDisease = formData.causeOfDeath === "Disease";
  const numDead = Number(formData.numberOfMortality) || 0;
  const exceedsBirds = formData.batchId !== "" && numDead > currentBirds;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (numDead < 0) return setError("Number of dead chickens cannot be negative.");
    if (numDead < 1) return setError("Enter at least 1 dead chicken.");
    if (isDuplicate)
      return setError("A mortality record already exists for this Batch + Date.");
    if (exceedsBirds)
      return setError(`Number of dead chickens (${numDead}) exceeds current birds in batch ${formData.batchId} (${currentBirds}).`);

    if (formData.causeOfDeath === NEW_VALUE && !newCauseOfDeath.trim())
      return setError("Please enter the new Cause of Death.");

    const payload = {
      ...formData,
      ...(formData.causeOfDeath === NEW_VALUE
        ? { causeOfDeath: undefined, newCauseOfDeath: newCauseOfDeath.trim() }
        : {}),
      numberOfMortality: numDead,
      currentBirds,
      mortalityRate: Number(mortalityRate),
    };
    if (window.__pbSaving) return;
    window.__pbSaving = true;
    setSaving(true);
    try {
      await createMortalityRecord(payload);
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch {}
      navigate("/records/mortality");
    } catch (err) {
      setError(err?.message || "Couldn't save this record. Please try again.");
      setSaving(false);
    } finally {
      window.__pbSaving = false;
    }
  };

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        { label: "RECORDS", path: "/records" },
        { label: "MORTALITY RECORD", path: "/records/mortality" },
        { label: "ADD MORTALITY" },
      ]}
    >

        <form className="amr-form-card" onSubmit={handleSubmit}>

          {error && (
            <div className="pb-error-banner">
              {error}
            </div>
          )}

          <div className="amr-section-header">
            <FiHeart />
            <h3>Mortality Details</h3>
            <div className="amr-line" />
          </div>

          <div className="amr-form-grid">
            <div className="amr-form-group">
              <label>Mortality ID</label>
              <input type="text" value={nextMortalityId} disabled />
              <small>Automatically generated when this record is saved.</small>
            </div>

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
              {formData.batchId && (
                <small>Current birds in this batch: {currentBirds}</small>
              )}
            </div>

            <div className="amr-form-group">
              <label>Number of Mortality <span className="amr-req">*</span></label>
              <input type="number" min="0" max={formData.batchId ? currentBirds : undefined}
                name="numberOfMortality"
                value={formData.numberOfMortality} onChange={handleChange}
                placeholder="Enter number of mortality" required />
              {exceedsBirds && (
                <small style={{ color: "#c0392b" }}>Cannot exceed {currentBirds} (current birds in batch).</small>
              )}
            </div>

            <div className="amr-form-group">
              <label>Cause of Death <span className="amr-req">*</span></label>
              <div style={{ display: "flex", gap: "10px" }}>
                <select name="causeOfDeath" value={formData.causeOfDeath} onChange={handleChange} style={{ flex: 1 }} required>
                  <option value="">Select cause</option>
                  {causeOfDeathOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value={NEW_VALUE}>Others</option>
                </select>
                {formData.causeOfDeath === NEW_VALUE && (
                  <input
                    type="text"
                    value={newCauseOfDeath}
                    onChange={(e) => setNewCauseOfDeath(e.target.value)}
                    placeholder="Enter cause of death..."
                    style={{ flex: 1 }}
                    required
                  />
                )}
              </div>
            </div>
          </div>

          {isDuplicate && (
            <div className="pb-warning-banner">
              <FiAlertTriangle /> A record already exists for this Batch + Date.
            </div>
          )}

          {isDisease && (
            <div className="pb-error-banner">
              <FiAlertTriangle /> Critical Health Alert: Disease-related mortality. Immediate veterinary consultation is recommended.
            </div>
          )}

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

          <div className="amr-form-actions">
            <p className="amr-req-note">Fields with * are required.</p>
            <div className="amr-action-btns">
              <button type="button" className="amr-cancel-btn" onClick={() => navigate("/records/mortality")}>
                <FiX /> Cancel
              </button>
              <button type="submit" className="amr-save-btn" disabled={isDuplicate || exceedsBirds || saving}>
                <FiSave /> {saving ? "Saving..." : "Save Record"}
              </button>
            </div>
          </div>

        </form>

    </PageLayout>
  );
}
