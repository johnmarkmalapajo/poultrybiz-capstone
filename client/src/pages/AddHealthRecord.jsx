import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiSave, FiX, FiActivity, FiDroplet, FiFileText, FiAlertTriangle, FiUserPlus } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./AddHealthRecord.css";
import { createHealthRecord, listHealthRecords } from "../api/healthRecord";
import { listFlocks } from "../api/flockProfile";
import { listQuarantineRecords } from "../api/quarantineIsolation";
import { listHealthOptions } from "../api/healthOptions";
import { listVeterinarians } from "../api/veterinarians";
import { listPersonnel } from "../api/personnelManpower";

const ROUTES = ["Drinking Water", "Injection", "Spray", "Feed Mix"];
const UNITS = ["mL", "mg", "g", "mg/kg", "mL/bird", "mL/L", "g/kg feed", "g/L"];
const FREQUENCIES = [
  "Once", "Daily", "Twice Daily", "Three Times Daily",
  "Every 4 Hours", "Every 6 Hours", "Every 8 Hours", "Every 12 Hours",
  "Weekly", "Monthly", "As Scheduled", "As Needed",
];
const NEW_VALUE = "__new__";

function computeAgeWeeks(dateAcquired) {
  if (!dateAcquired) return "";
  const start = new Date(dateAcquired);
  if (isNaN(start)) return "";
  const weeksElapsed = Math.max(0, Math.floor((Date.now() - start.getTime()) / (86400000 * 7)));
  return `${16 + weeksElapsed} weeks`;
}

export default function AddHealthRecord() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    batchId: "",
    diagnosisId: "",
    date: "",
    numberOfBirdsAdministered: "",
    vaccineOrDrug: "",
    routeOfAdmin: "",
    dosage: "",
    dosageUnit: "",
    frequency: "",
    administeredByType: "",
    personnelId: "",
    vetId: "",
    nextSchedule: "",
    remarks: "",
  });
  const [newRoute, setNewRoute] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newFrequency, setNewFrequency] = useState("");
  const [newVet, setNewVet] = useState("");

  const [flocks, setFlocks] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [nextMedicationId, setNextMedicationId] = useState("MED-001");
  const [quarantineMedicationByBatch, setQuarantineMedicationByBatch] = useState({});
  const [quarantineRecords, setQuarantineRecords] = useState([]);
  const [routeOptions, setRouteOptions] = useState([]);
  const [unitOptions, setUnitOptions] = useState([]);
  const [frequencyOptions, setFrequencyOptions] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [vets, setVets] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listFlocks()
      .then((d) => setFlocks(Array.isArray(d) ? d : d.records || d.flocks || []))
      .catch(() => setFlocks([]));
    listHealthRecords()
      .then((d) => {
        const all = Array.isArray(d) ? d : d.records || d.data || [];
        setDiagnoses(all.filter((r) => r.recordType === "Diagnosis"));
        // Existing quarantine-only Medication/Vaccination records (no
        // Diagnosis link) -- while a batch is still Ongoing Quarantine,
        // only one of these may exist for it.
        setQuarantineMedicationByBatch(
          Object.fromEntries(
            all
              .filter((r) => r.recordType === "Vaccination" && !r.diagnosisId)
              .map((r) => [r.batchId, r])
          )
        );

        let max = 0;
        all.forEach((r) => {
          const m = /^MED-(\d+)$/.exec(r.medicationCode || "");
          if (m) max = Math.max(max, parseInt(m[1], 10));
        });
        setNextMedicationId(`MED-${String(max + 1).padStart(3, "0")}`);
      })
      .catch(() => setDiagnoses([]));
    listQuarantineRecords()
      .then((d) => {
        const all = Array.isArray(d) ? d : d.records || d.data || [];
        setQuarantineRecords(all.filter((r) => r.recordType === "Quarantine" && r.status === "Ongoing"));
      })
      .catch(() => setQuarantineRecords([]));
    listHealthOptions("route").then((d) => setRouteOptions((d.options || []).map((o) => o.value))).catch(() => setRouteOptions([]));
    listHealthOptions("unit").then((d) => setUnitOptions((d.options || []).map((o) => o.value))).catch(() => setUnitOptions([]));
    listHealthOptions("frequency").then((d) => setFrequencyOptions((d.options || []).map((o) => o.value))).catch(() => setFrequencyOptions([]));
    listPersonnel()
      .then((d) => setPersonnel(Array.isArray(d) ? d : d.records || d.personnel || []))
      .catch(() => setPersonnel([]));
    listVeterinarians()
      .then((d) => setVets(d.veterinarians || []))
      .catch(() => setVets([]));
  }, []);

  const routeChoices = [...new Set([...ROUTES, ...routeOptions])];
  const unitChoices = [...new Set([...UNITS, ...unitOptions])];
  const frequencyChoices = [...new Set([...FREQUENCIES, ...frequencyOptions])];

  const batchOptions = [...new Set(flocks.map((f) => f.batchId).filter(Boolean))];
  const ongoingQuarantineRecord = quarantineRecords.find((r) => r.batchId === formData.batchId);
  const isBatchInQuarantine = !!formData.batchId && !!ongoingQuarantineRecord;
  const existingQuarantineMedication = isBatchInQuarantine ? quarantineMedicationByBatch[formData.batchId] : null;
  const batchDiagnoses = diagnoses.filter((d) => d.batchId === formData.batchId);
  const selectedFlock = flocks.find((f) => f.batchId === formData.batchId);
  const targetAgePreview = selectedFlock ? computeAgeWeeks(selectedFlock.dateAcquired) : "";
  // While a batch is still under Ongoing Quarantine, birds administered
  // is checked against that Quarantine record's own Head Count -- not
  // the flock's overall current quantity, which can differ.
  const maxBirdsAllowed = isBatchInQuarantine
    ? ongoingQuarantineRecord.headCount
    : selectedFlock?.currentQuantity;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleBatchChange = (e) => {
    // Changing Batch resets any previously selected Diagnosis -- it
    // almost certainly no longer applies to the new batch.
    setFormData((prev) => ({ ...prev, batchId: e.target.value, diagnosisId: "" }));
    setError("");
  };

  const scheduleInvalid = formData.nextSchedule && formData.date && formData.nextSchedule < formData.date;
  // Local calendar date, not UTC -- toISOString() would return the
  // wrong day during early-morning hours in timezones ahead of UTC
  // (e.g. PH, UTC+8), incorrectly flagging today's own date as future
  // and permanently disabling Save.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  // The actual Medication/Vaccination Date can't be future -- Schedule
  // (checked above) is a different field and CAN be future.
  const dateInvalid = formData.date && formData.date > today;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!formData.batchId) return setError("Please select a Batch ID.");
    if (existingQuarantineMedication) return setError(`A Medication/Vaccination record already exists for this batch while it's in Quarantine (${existingQuarantineMedication.medicationCode}). Edit that record instead.`);
    if (!isBatchInQuarantine && !formData.diagnosisId) return setError("This batch is not in Quarantine, so please select the Diagnosis this record belongs to.");
    if (dateInvalid) return setError("Date cannot be in the future.");
    if (scheduleInvalid) return setError("Schedule cannot be earlier than the record Date.");
    const effectiveBirdsAdministered = isBatchInQuarantine ? maxBirdsAllowed : formData.numberOfBirdsAdministered;
    if (!/^\d+$/.test(String(effectiveBirdsAdministered ?? "").trim()) || Number(effectiveBirdsAdministered) <= 0) {
      return setError(isBatchInQuarantine
        ? "This batch's current Quarantine Head Count is 0 — there are no birds to record medication for."
        : "No. of Birds Administered must be a whole number greater than zero.");
    }
    if (!isBatchInQuarantine && selectedFlock && maxBirdsAllowed != null && Number(effectiveBirdsAdministered) > maxBirdsAllowed) {
      return setError(`No. of Birds Administered cannot exceed the available birds in this batch (${maxBirdsAllowed}).`);
    }
    if (formData.routeOfAdmin === NEW_VALUE && !newRoute.trim()) return setError("Please enter the new Route of Administration.");
    if (formData.dosageUnit === NEW_VALUE && !newUnit.trim()) return setError("Please enter the new Unit.");
    if (formData.frequency === NEW_VALUE && !newFrequency.trim()) return setError("Please enter the new Frequency.");
    if (!formData.administeredByType) return setError("Please select whether this was administered by Staff or Vet.");
    if (formData.administeredByType === "Staff" && !formData.personnelId) return setError("Please select a staff member.");
    if (formData.administeredByType === "Vet" && !formData.vetId && !newVet.trim()) return setError("Please select or add a veterinarian.");

    const payload = {
      ...formData,
      recordType: "Vaccination",
      numberOfBirdsAdministered: isBatchInQuarantine ? maxBirdsAllowed : formData.numberOfBirdsAdministered,
      diagnosisId: isBatchInQuarantine ? undefined : formData.diagnosisId,
      routeOfAdmin: formData.routeOfAdmin === NEW_VALUE ? undefined : formData.routeOfAdmin,
      newRoute: formData.routeOfAdmin === NEW_VALUE ? newRoute.trim() : undefined,
      dosageUnit: formData.dosageUnit === NEW_VALUE ? undefined : formData.dosageUnit,
      newUnit: formData.dosageUnit === NEW_VALUE ? newUnit.trim() : undefined,
      frequency: formData.frequency === NEW_VALUE ? undefined : formData.frequency,
      newFrequency: formData.frequency === NEW_VALUE ? newFrequency.trim() : undefined,
      newVet: formData.administeredByType === "Vet" && newVet.trim() ? newVet.trim() : undefined,
    };

    if (window.__pbSaving) return;
    window.__pbSaving = true;
    setSaving(true);
    try {
      await createHealthRecord(payload);
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { /* ignore */ }
      navigate(`/records/health?tab=vaccination`);
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
        { label: "HEALTH RECORD", path: `/records/health?tab=vaccination` },
        { label: "ADD MEDICATION/VACCINATION" },
      ]}
    >
        <form className="ahr-form-card" onSubmit={handleSubmit}>
          {error && <div className="pb-error-banner">{error}</div>}

          <div className="ahr-section-header">
            <FiDroplet />
            <h3>Batch &amp; Diagnosis Link</h3>
            <div className="ahr-line" />
          </div>

          <div className="ahr-form-grid">
            <div className="ahr-form-group">
              <label>Medication ID</label>
              <input type="text" value={nextMedicationId} disabled />
              <small>Automatically generated when this record is saved.</small>
            </div>

            <div className="ahr-form-group">
              <label>Batch ID <span className="ahr-req">*</span></label>
              <select name="batchId" value={formData.batchId} onChange={handleBatchChange} required>
                <option value="">Select batch ID</option>
                {batchOptions.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {formData.batchId && existingQuarantineMedication && (
              <div className="pb-error-banner" style={{ gridColumn: "1 / -1" }}>
                A Medication/Vaccination record already exists for this batch while it's in Quarantine ({existingQuarantineMedication.medicationCode}). Edit that record instead of creating a new one.
              </div>
            )}

            {formData.batchId && (
              isBatchInQuarantine ? (
                <div className="ahr-form-group">
                  <label>Diagnosis</label>
                  <input type="text" value="Not needed — this batch is currently in Quarantine" disabled />
                  <small>Recorded directly against the batch; no Diagnosis link is required while it's in Quarantine.</small>
                </div>
              ) : (
                <div className="ahr-form-group">
                  <label>Diagnosis ID <span className="ahr-req">*</span></label>
                  <select name="diagnosisId" value={formData.diagnosisId} onChange={handleChange} required>
                    <option value="">Select Diagnosis ID</option>
                    {batchDiagnoses.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.diagnosisCode || "—"}
                      </option>
                    ))}
                  </select>
                  <small>A treatment/vaccination is always linked to a specific Diagnosis, never Batch ID alone.</small>
                </div>
              )
            )}

            <div className="ahr-form-group">
              <label>Date <span className="ahr-req">*</span></label>
              <input type="date" name="date" value={formData.date} onChange={handleChange} max={today} required />
              {dateInvalid && <small style={{ color: "#c0392b" }}>Date cannot be in the future.</small>}
            </div>
          </div>

          <div className="ahr-section-header">
            <FiActivity />
            <h3>Medication/Vaccination Information</h3>
            <div className="ahr-line" />
          </div>

          <div className="ahr-form-grid">
            <div className="ahr-form-group">
              <label>No. of Birds Administered <span className="ahr-req">*</span></label>
              {isBatchInQuarantine ? (
                <>
                  <input type="text" value={maxBirdsAllowed ?? ""} disabled />
                  <small>Automatically the batch's current Quarantine Head Count — not editable.</small>
                </>
              ) : (
                <>
                  <input type="text" inputMode="numeric" name="numberOfBirdsAdministered"
                    value={formData.numberOfBirdsAdministered}
                    onChange={(e) => setFormData((prev) => ({ ...prev, numberOfBirdsAdministered: e.target.value.replace(/[^\d]/g, "") }))}
                    placeholder="Enter number of birds administered" required />
                  {selectedFlock && <small>Available birds in this batch: {maxBirdsAllowed}</small>}
                </>
              )}
            </div>

            <div className="ahr-form-group">
              <label>Vaccine / Drug <span className="ahr-req">*</span></label>
              <input type="text" name="vaccineOrDrug" value={formData.vaccineOrDrug}
                onChange={handleChange} placeholder="Enter vaccine or drug name" required />
            </div>

            <div className="ahr-form-group">
              <label>Target Age / Stage</label>
              <input type="text" value={targetAgePreview || "—"} disabled />
              <small>Derived automatically from the batch's Date Acquired.</small>
            </div>

            <div className="ahr-form-group">
              <label>Route of Administration <span className="ahr-req">*</span></label>
              <div style={{ display: "flex", gap: "10px" }}>
                <select name="routeOfAdmin" value={formData.routeOfAdmin} onChange={handleChange} required style={{ flex: 1 }}>
                  <option value="">Select route</option>
                  {routeChoices.map((r) => <option key={r} value={r}>{r}</option>)}
                  <option value={NEW_VALUE}>Others</option>
                </select>
                {formData.routeOfAdmin === NEW_VALUE && (
                  <input type="text" value={newRoute} onChange={(e) => setNewRoute(e.target.value)}
                    placeholder="Enter route..." style={{ flex: 1 }} required />
                )}
              </div>
            </div>

            <div className="ahr-form-group">
              <label>Dosage</label>
              <input type="text" inputMode="decimal" name="dosage" value={formData.dosage}
                onChange={handleChange} placeholder="e.g. 0.5" />
            </div>

            <div className="ahr-form-group">
              <label>Unit</label>
              <div style={{ display: "flex", gap: "10px" }}>
                <select name="dosageUnit" value={formData.dosageUnit} onChange={handleChange} style={{ flex: 1 }}>
                  <option value="">Select unit</option>
                  {unitChoices.map((u) => <option key={u} value={u}>{u}</option>)}
                  <option value={NEW_VALUE}>Others</option>
                </select>
                {formData.dosageUnit === NEW_VALUE && (
                  <input type="text" value={newUnit} onChange={(e) => setNewUnit(e.target.value)}
                    placeholder="Enter unit..." style={{ flex: 1 }} required />
                )}
              </div>
            </div>

            <div className="ahr-form-group">
              <label>Frequency</label>
              <div style={{ display: "flex", gap: "10px" }}>
                <select name="frequency" value={formData.frequency} onChange={handleChange} style={{ flex: 1 }}>
                  <option value="">Select frequency</option>
                  {frequencyChoices.map((f) => <option key={f} value={f}>{f}</option>)}
                  <option value={NEW_VALUE}>Others</option>
                </select>
                {formData.frequency === NEW_VALUE && (
                  <input type="text" value={newFrequency} onChange={(e) => setNewFrequency(e.target.value)}
                    placeholder="Enter frequency..." style={{ flex: 1 }} required />
                )}
              </div>
            </div>
          </div>

          <div className="ahr-section-header">
            <FiActivity />
            <h3>Administered By</h3>
            <div className="ahr-line" />
          </div>

          <div className="ahr-form-grid">
            <div className="ahr-form-group">
              <label>Type <span className="ahr-req">*</span></label>
              <select name="administeredByType" value={formData.administeredByType} onChange={handleChange} required>
                <option value="">Select type</option>
                <option value="Staff">Staff</option>
                <option value="Vet">Vet</option>
              </select>
            </div>

            {formData.administeredByType === "Staff" && (
              <div className="ahr-form-group">
                <label>Staff Member <span className="ahr-req">*</span></label>
                <select name="personnelId" value={formData.personnelId} onChange={handleChange} required>
                  <option value="">Select staff member</option>
                  {personnel.map((p) => (
                    <option key={p._id} value={p._id}>{p.user?.name || p.name || p._id}</option>
                  ))}
                </select>
              </div>
            )}

            {formData.administeredByType === "Vet" && (
              <div className="ahr-form-group">
                <label>Veterinarian <span className="ahr-req">*</span></label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <select name="vetId" value={formData.vetId} onChange={handleChange} style={{ flex: 1 }}>
                    <option value="">Select veterinarian</option>
                    {vets.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
                    <option value={NEW_VALUE}>+ Add New Vet</option>
                  </select>
                  {(formData.vetId === NEW_VALUE || vets.length === 0) && (
                    <input type="text" value={newVet} onChange={(e) => setNewVet(e.target.value)}
                      placeholder="Enter veterinarian name..." style={{ flex: 1 }} />
                  )}
                </div>
                {vets.length === 0 && (
                  <small><FiUserPlus /> No veterinarians on file yet — type a name to add one.</small>
                )}
              </div>
            )}
          </div>

          <div className="ahr-section-header">
            <FiActivity />
            <h3>Scheduling</h3>
            <div className="ahr-line" />
          </div>

          <div className="ahr-form-grid">
            <div className="ahr-form-group">
              <label>Schedule</label>
              <input type="date" name="nextSchedule" value={formData.nextSchedule} min={formData.date || undefined} onChange={handleChange} />
              {scheduleInvalid && <small style={{ color: "#c0392b" }}>Cannot be earlier than the record date.</small>}
            </div>
          </div>

          <div className="ahr-section-header">
            <FiFileText />
            <h3>Additional Information</h3>
            <div className="ahr-line" />
          </div>

          <div className="ahr-form-group ahr-full-width">
            <label>Remarks</label>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange}
              placeholder="Enter remarks, aftereffects, or reactions..." maxLength={500} />
            <small className="ahr-char-count">{formData.remarks.length} / 500</small>
          </div>

          <div className="ahr-form-actions">
            <p className="ahr-req-note">Fields with * are required.</p>
            <div className="ahr-action-btns">
              <button type="button" className="ahr-cancel-btn" onClick={() => navigate(`/records/health?tab=vaccination`)}>
                <FiX /> Cancel
              </button>
              <button type="submit" className="ahr-save-btn" disabled={saving || scheduleInvalid || dateInvalid || !!existingQuarantineMedication}>
                <FiSave /> {saving ? "Saving..." : "Save Record"}
              </button>
            </div>
          </div>
        </form>
    </PageLayout>
  );
}