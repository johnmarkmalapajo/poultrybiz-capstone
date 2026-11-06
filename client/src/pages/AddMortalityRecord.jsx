import { phToday } from "../phDate";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiSave, FiX, FiHeart, FiFileText, FiActivity, FiAlertTriangle } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./AddMortalityRecord.css";
import { createMortalityRecord, listMortalityRecords } from "../api/mortalityRecord";
import { listFlocks } from "../api/flockProfile";
import { listQuarantineRecords } from "../api/quarantineIsolation";
import { mortalityBatchOptions } from "../mortalityBatchOptions";
import { listHealthOptions } from "../api/healthOptions";
import { useLanguage } from "../i18n/LanguageContext";

const NEW_VALUE = "__new__";
const CAUSES = ["Disease", "Stress", "Dehydration", "Accident", "Unknown"];

// Local calendar date, not UTC -- toISOString() reports the wrong day
// during early-morning hours in timezones ahead of UTC (e.g. PH).
const localToday = () => {
  return phToday();
};

export default function AddMortalityRecord() {
  const { t: tr } = useLanguage();
  const navigate = useNavigate();
  const today = localToday();

  const [formData, setFormData] = useState({
    date: today,
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

  // A batch that already has a mortality record for the selected date is not
  // offered again for that date (source of truth: saved records in the DB).
  const mortDay = (r) => String(r.date || "").slice(0, 10);
  const recordedBatchIdsForDate = new Set(
    mortRecords.filter((r) => mortDay(r) === formData.date).map((r) => r.batchId)
  );
  const allBatchOptions = mortalityBatchOptions(flocks, isolationRecords);
  const batchOptions = allBatchOptions.filter((id) => !recordedBatchIdsForDate.has(id));
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
      (r) => r.batchId === formData.batchId && mortDay(r) === formData.date
    );

  const isDisease = formData.causeOfDeath === "Disease";
  const numDead = Number(formData.numberOfMortality) || 0;
  const exceedsBirds = formData.batchId !== "" && numDead > currentBirds;
  const isFutureDate = formData.date !== "" && formData.date > today;

  const handleChange = (e) => {
    const { name } = e.target;
    let value = e.target.value;
    // iOS date pickers ignore the `max` attribute, so enforce it here too.
    const futureBlocked = e.target.type === "date" && e.target.max && value > e.target.max;
    if (futureBlocked) value = e.target.max;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      // Moving to a date where the chosen batch is already recorded clears it.
      if (
        name === "date" &&
        prev.batchId &&
        mortRecords.some((r) => r.batchId === prev.batchId && mortDay(r) === value)
      ) {
        next.batchId = "";
      }
      return next;
    });
    setError(futureBlocked ? tr("Date cannot be a future date.") : "");
  };
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (isFutureDate) return setError(tr("Date cannot be a future date."));
    if (numDead < 0) return setError(tr("Number of dead chickens cannot be negative."));
    if (numDead < 1) return setError(tr("Enter at least 1 dead chicken."));
    if (isDuplicate)
      return setError(tr("A mortality record already exists for this Batch + Date."));
    if (exceedsBirds)
      return setError(`Number of dead chickens (${numDead}) exceeds current birds in batch ${formData.batchId} (${currentBirds}).`);

    if (formData.causeOfDeath === NEW_VALUE && !newCauseOfDeath.trim())
      return setError(tr("Please enter the new Cause of Death."));

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
      setError(tr(err?.message || "Couldn't save this record. Please try again."));
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
            <h3>{tr("Mortality Details")}</h3>
            <div className="amr-line" />
          </div>

          <div className="amr-form-grid">
            <div className="amr-form-group">
              <label>{tr("Mortality ID")}</label>
              <input type="text" value={nextMortalityId} disabled />
              <small>{tr("Automatically generated when this record is saved.")}</small>
            </div>

            <div className="amr-form-group">
              <label>{tr("Date")}{" "}<span className="amr-req">*</span></label>
              <input type="date" name="date" value={formData.date} onChange={handleChange} max={today} required />
              {isFutureDate && (
                <small style={{ color: "#c0392b" }}>{tr("Date cannot be a future date.")}</small>
              )}
            </div>

            <div className="amr-form-group">
              <label>{tr("Batch ID")}{" "}<span className="amr-req">*</span></label>
              <select name="batchId" value={formData.batchId} onChange={handleChange} required>
                <option value="">{tr("Select batch ID")}</option>
                {batchOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              {formData.batchId && (
                <small>{tr("Current birds in this batch:")}{" "}{currentBirds}</small>
              )}
              {allBatchOptions.length > 0 && batchOptions.length === 0 && (
                <small>{tr("All available batches already have a mortality record for this date.")}</small>
              )}
            </div>

            <div className="amr-form-group">
              <label>{tr("Number of Mortality")}{" "}<span className="amr-req">*</span></label>
              <input type="number" min="0" max={formData.batchId ? currentBirds : undefined}
                name="numberOfMortality"
                value={formData.numberOfMortality} onChange={handleChange}
                placeholder={tr("Enter number of mortality")} required />
              {exceedsBirds && (
                <small style={{ color: "#c0392b" }}>{tr("Cannot exceed")}{" "}{currentBirds}{" "}{tr("(current birds in batch).")}</small>
              )}
            </div>

            <div className="amr-form-group">
              <label>{tr("Cause of Death")}{" "}<span className="amr-req">*</span></label>
              <div style={{ display: "flex", gap: "10px" }}>
                <select name="causeOfDeath" value={formData.causeOfDeath} onChange={handleChange} style={{ flex: 1 }} required>
                  <option value="">{tr("Select cause")}</option>
                  {causeOfDeathOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value={NEW_VALUE}>{tr("Others")}</option>
                </select>
                {formData.causeOfDeath === NEW_VALUE && (
                  <input
                    type="text"
                    value={newCauseOfDeath}
                    onChange={(e) => setNewCauseOfDeath(e.target.value)}
                    placeholder={tr("Enter cause of death...")}
                    style={{ flex: 1 }}
                    required
                  />
                )}
              </div>
            </div>
          </div>

          {isDuplicate && (
            <div className="pb-warning-banner">
              <FiAlertTriangle />{" "}{tr("A record already exists for this Batch + Date.")}</div>
          )}

          {isDisease && (
            <div className="pb-error-banner">
              <FiAlertTriangle />{" "}{tr("Critical Health Alert: Disease-related mortality. Immediate veterinary consultation is recommended.")}</div>
          )}

          <div className="amr-section-header">
            <FiFileText />
            <h3>{tr("Additional Information")}</h3>
            <div className="amr-line" />
          </div>

          <div className="amr-form-group amr-full-width">
            <label>{tr("Remarks")}</label>
            <textarea name="remarks"
              value={formData.remarks} onChange={handleChange}
              placeholder={tr("Enter remarks or observations...")} maxLength={500} />
            <small className="amr-char-count">{formData.remarks.length} / 500</small>
          </div>

          <div className="amr-form-actions">
            <p className="amr-req-note">{tr("Fields with * are required.")}</p>
            <div className="amr-action-btns">
              <button type="button" className="amr-cancel-btn" onClick={() => navigate("/records/mortality")}>
                <FiX />{" "}{tr("Cancel")}</button>
              <button type="submit" className="amr-save-btn" disabled={isDuplicate || exceedsBirds || isFutureDate || saving}>
                <FiSave /> {saving ? "Saving..." : "Save Record"}
              </button>
            </div>
          </div>

        </form>

    </PageLayout>
  );
}