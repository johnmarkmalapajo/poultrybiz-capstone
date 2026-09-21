import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiSave, FiX, FiActivity, FiDroplet, FiFileText, FiAlertTriangle, FiPlus, FiUserPlus } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditHealthRecord.css";
import { getHealthRecord, updateHealthRecord } from "../api/healthRecord";
import { listQuarantineRecords } from "../api/quarantineIsolation";
import { listHealthOptions } from "../api/healthOptions";
import { listVeterinarians } from "../api/veterinarians";
import { listPersonnel } from "../api/personnelManpower";

const OBSERVATIONS = [
  "Sneezing / Coughing", "Nasal Discharge", "Watery Eyes / Swelling Around Eyes",
  "Ruffled Feathers", "Drop in Feed Intake", "Drop in Water Intake",
  "Drop in Egg Production", "Soft-shelled or Misshaped Eggs", "Lethargy / Weakness",
  "Diarrhea (watery / greenish / bloody)", "Nervous Signs (twisting neck, paralysis, tremors)",
  "Sudden Death",
];
const ROUTES = ["Drinking Water", "Injection", "Spray", "Feed Mix"];
const UNITS = ["mL", "mg", "g", "mg/kg", "mL/bird", "mL/L", "g/kg feed", "g/L"];
const FREQUENCIES = [
  "Once", "Daily", "Twice Daily", "Three Times Daily",
  "Every 4 Hours", "Every 6 Hours", "Every 8 Hours", "Every 12 Hours",
  "Weekly", "Monthly", "As Scheduled", "As Needed",
];
const NEW_VALUE = "__new__";
const d = (v) => (v ? String(v).slice(0, 10) : "");

export default function EditHealthRecord() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [recordType, setRecordType] = useState("Diagnosis");
  const [diagnosisCode, setDiagnosisCode] = useState("");
  const [medicationCode, setMedicationCode] = useState("");
  const [isolationId, setIsolationId] = useState("");
  const [isolationCompleted, setIsolationCompleted] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [numberOfBirdsAffected, setNumberOfBirdsAffected] = useState("");
  const [presumptiveDiagnosis, setPresumptiveDiagnosis] = useState("");
  const [numberMortality, setNumberMortality] = useState("");
  const [treatmentApplied, setTreatmentApplied] = useState("");
  const [treatments, setTreatments] = useState([]);
  const [date, setDate] = useState("");
  const [nextSchedule, setNextSchedule] = useState("");
  const [remarks, setRemarks] = useState("");

  const [symptomsObserved, setSymptomsObserved] = useState("");
  const [newSymptomsObserved, setNewSymptomsObserved] = useState("");
  const [observationOptions, setObservationOptions] = useState(OBSERVATIONS);
  const [newPresumptiveDiagnosis, setNewPresumptiveDiagnosis] = useState("");
  const [symptomOptions, setSymptomOptions] = useState([]);
  const [vetDiagnosis, setVetDiagnosis] = useState("");
  const [newVetDiagnosis, setNewVetDiagnosis] = useState("");
  const [vetDiagnosisOptions, setVetDiagnosisOptions] = useState([]);

  const [diagnosisId, setDiagnosisId] = useState("");
  const [numberOfBirdsAdministered, setNumberOfBirdsAdministered] = useState("");
  const [ongoingQuarantineHeadCount, setOngoingQuarantineHeadCount] = useState(null);
  const [vaccineOrDrug, setVaccineOrDrug] = useState("");
  const [targetAge, setTargetAge] = useState("");
  const [routeOfAdmin, setRouteOfAdmin] = useState("");
  const [newRoute, setNewRoute] = useState("");
  const [dosage, setDosage] = useState("");
  const [dosageUnit, setDosageUnit] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [frequency, setFrequency] = useState("");
  const [newFrequency, setNewFrequency] = useState("");
  const [administeredByType, setAdministeredByType] = useState("");
  const [personnelId, setPersonnelId] = useState("");
  const [vetId, setVetId] = useState("");
  const [newVet, setNewVet] = useState("");
  const [schedules, setSchedules] = useState([]);
  const [addingSchedule, setAddingSchedule] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState("");

  const [routeOptions, setRouteOptions] = useState([]);
  const [unitOptions, setUnitOptions] = useState([]);
  const [frequencyOptions, setFrequencyOptions] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [vets, setVets] = useState([]);

  const isDiagnosis = recordType === "Diagnosis";
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (isDiagnosis || diagnosisId || !batchId) {
      setOngoingQuarantineHeadCount(null);
      return;
    }
    listQuarantineRecords()
      .then((data) => {
        const all = Array.isArray(data) ? data : data.records || data.data || [];
        const match = all.find(
          (r) => r.recordType === "Quarantine" && r.status === "Ongoing" && r.batchId === batchId
        );
        setOngoingQuarantineHeadCount(match ? match.headCount : null);
      })
      .catch(() => setOngoingQuarantineHeadCount(null));
  }, [isDiagnosis, diagnosisId, batchId]);

  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const json = await getHealthRecord(id);
        const rec = json.record || json.data || json;
        setRecordType(rec.recordType || "Diagnosis");
        setBatchId(rec.batchId || "");
        setDate(d(rec.date));
        setNextSchedule(d(rec.nextSchedule));
        setRemarks(rec.remarks || "");

        if (rec.recordType === "Diagnosis") {
          setDiagnosisCode(rec.diagnosisCode || "");
          setIsolationId(rec.isolationId?.isolationId || rec.isolationId || "");
          setIsolationCompleted(rec.isolationId?.currentStatus === "Completed");
          setNumberOfBirdsAffected(rec.numberOfBirdsAffected ?? "");
          setPresumptiveDiagnosis(rec.presumptiveDiagnosis || "");
          setNumberMortality(rec.numberMortality ?? "");
          setSymptomsObserved(rec.symptomsObserved || "");
          setVetDiagnosis(rec.vetDiagnosis || "");
          setTreatmentApplied(rec.treatmentApplied || "");
          setTreatments(rec.treatments || []);
          setTargetAge(rec.targetAge || "");
        } else {
          setDiagnosisId(rec.diagnosisId || "");
          setDiagnosisCode(rec.diagnosisCode || "");
          setMedicationCode(rec.medicationCode || "");
          setNumberOfBirdsAdministered(rec.numberOfBirdsAdministered ?? "");
          setVaccineOrDrug(rec.vaccineOrDrug || "");
          setTargetAge(rec.targetAge || "");
          setRouteOfAdmin(rec.routeOfAdmin || "");
          setDosage(rec.dosage || "");
          setDosageUnit(rec.dosageUnit || "");
          setFrequency(rec.frequency || "");
          setAdministeredByType(rec.administeredByType || "");
          if (rec.administeredByRefModel === "Personnel") setPersonnelId(rec.administeredByRef);
          if (rec.administeredByRefModel === "Veterinarian") setVetId(rec.administeredByRef);
          setSchedules(rec.schedules || []);
        }
      } catch (err) {
        setError(err?.message || "Couldn't load this record.");
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id]);

  useEffect(() => {
    listHealthOptions("symptom").then((r) => setSymptomOptions((r.options || []).map((o) => o.value))).catch(() => setSymptomOptions([]));
    listHealthOptions("observation").then((r) => {
      const fetched = (r.options || []).map((o) => o.value);
      setObservationOptions([...OBSERVATIONS, ...fetched.filter((v) => !OBSERVATIONS.includes(v))]);
    }).catch(() => setObservationOptions(OBSERVATIONS));
    listHealthOptions("vetDiagnosis").then((r) => setVetDiagnosisOptions((r.options || []).map((o) => o.value))).catch(() => setVetDiagnosisOptions([]));
    listHealthOptions("route").then((r) => setRouteOptions((r.options || []).map((o) => o.value))).catch(() => setRouteOptions([]));
    listHealthOptions("unit").then((r) => setUnitOptions((r.options || []).map((o) => o.value))).catch(() => setUnitOptions([]));
    listHealthOptions("frequency").then((r) => setFrequencyOptions((r.options || []).map((o) => o.value))).catch(() => setFrequencyOptions([]));
    listPersonnel().then((d2) => setPersonnel(Array.isArray(d2) ? d2 : d2.records || d2.personnel || [])).catch(() => setPersonnel([]));
    listVeterinarians().then((d2) => setVets(d2.veterinarians || [])).catch(() => setVets([]));
  }, []);

  const routeChoices = [...new Set([...ROUTES, ...routeOptions])];
  const unitChoices = [...new Set([...UNITS, ...unitOptions])];
  const frequencyChoices = [...new Set([...FREQUENCIES, ...frequencyOptions])];

  const scheduleInvalid = scheduleDraft && date && scheduleDraft < date;

  const handleAddSchedule = () => {
    setAddingSchedule(true);
    setScheduleDraft("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    let payload;
    if (isDiagnosis) {
      if (symptomsObserved === NEW_VALUE && !newSymptomsObserved.trim()) {
        setError("Please enter the new Observation.");
        return;
      }
      if (presumptiveDiagnosis === NEW_VALUE && !newPresumptiveDiagnosis.trim()) {
        setError("Please enter the new Presumptive Diagnosis.");
        return;
      }
      if (vetDiagnosis === NEW_VALUE && !newVetDiagnosis.trim()) {
        setError("Please enter the new Vet Diagnosis.");
        return;
      }
      payload = {
        ...(symptomsObserved === NEW_VALUE
          ? { newSymptomsObserved: newSymptomsObserved.trim() }
          : { symptomsObserved }),
        remarks,
        nextSchedule: nextSchedule || undefined,
        ...(presumptiveDiagnosis === NEW_VALUE
          ? { newPresumptiveDiagnosis: newPresumptiveDiagnosis.trim() }
          : { presumptiveDiagnosis }),
        ...(vetDiagnosis === NEW_VALUE
          ? { newVetDiagnosis: newVetDiagnosis.trim() }
          : { vetDiagnosis }),
      };
    } else {
      if (scheduleDraft && scheduleInvalid) {
        setError("The new schedule cannot be earlier than the record date.");
        return;
      }
      if (routeOfAdmin === NEW_VALUE && !newRoute.trim()) return setError("Please enter the new Route of Administration.");
      if (dosageUnit === NEW_VALUE && !newUnit.trim()) return setError("Please enter the new Unit.");
      if (frequency === NEW_VALUE && !newFrequency.trim()) return setError("Please enter the new Frequency.");
      if (!administeredByType) return setError("Please select whether this was administered by Staff or Vet.");
      if (administeredByType === "Staff" && !personnelId) return setError("Please select a staff member.");
      if (administeredByType === "Vet" && !vetId && !newVet.trim()) return setError("Please select or add a veterinarian.");

      payload = {
        date,
        numberOfBirdsAdministered,
        vaccineOrDrug,
        dosage,
        remarks,
        administeredByType,
        personnelId: administeredByType === "Staff" ? personnelId : undefined,
        vetId: administeredByType === "Vet" && vetId !== NEW_VALUE ? vetId : undefined,
        newVet: administeredByType === "Vet" && newVet.trim() ? newVet.trim() : undefined,
        routeOfAdmin: routeOfAdmin === NEW_VALUE ? undefined : routeOfAdmin,
        newRoute: routeOfAdmin === NEW_VALUE ? newRoute.trim() : undefined,
        dosageUnit: dosageUnit === NEW_VALUE ? undefined : dosageUnit,
        newUnit: dosageUnit === NEW_VALUE ? newUnit.trim() : undefined,
        frequency: frequency === NEW_VALUE ? undefined : frequency,
        newFrequency: frequency === NEW_VALUE ? newFrequency.trim() : undefined,
        addSchedule: addingSchedule && scheduleDraft ? scheduleDraft : undefined,
      };
    }

    try {
      setSaving(true);
      setError("");
      await updateHealthRecord(id, payload);
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch {}
      navigate(`/records/health?tab=${isDiagnosis ? "diagnosis" : "vaccination"}`);
    } catch (err) {
      setSaving(false);
      setError(err?.message || "Couldn't save changes. Please try again.");
    }
  };

  if (loading) {
    return (
      <PageLayout background="#f4f4f2" breadcrumbItems={[{ label: "RECORDS", path: "/records" }, { label: "HEALTH RECORD" }]}>
        <p className="pb-loading-text">Loading record...</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        { label: "RECORDS", path: "/records" },
        { label: "HEALTH RECORD", path: `/records/health?tab=${isDiagnosis ? "diagnosis" : "vaccination"}` },
        { label: isDiagnosis ? "EDIT DIAGNOSIS" : "EDIT MEDICATION/VACCINATION" },
      ]}
    >
      <form className="ehr-form-card" onSubmit={handleSubmit}>
        {error && <div className="pb-error-banner">{error}</div>}

        {isDiagnosis ? (
          <>
            <div className="ehr-section-header">
              <FiDroplet />
              <h3>Diagnosis (System-Managed)</h3>
              <div className="ehr-line" />
            </div>

            <div className="ehr-form-grid">
              <div className="ehr-form-group">
                <label>Diagnosis ID</label>
                <input type="text" value={diagnosisCode || "—"} disabled />
              </div>
              <div className="ehr-form-group">
                <label>Isolation ID</label>
                <input type="text" value={isolationId} disabled />
              </div>
              <div className="ehr-form-group">
                <label>Batch ID</label>
                <input type="text" value={batchId} disabled />
              </div>
              <div className="ehr-form-group">
                <label>Date</label>
                <input type="text" value={date} disabled />
              </div>
              <div className="ehr-form-group">
                <label>Age</label>
                <input type="text" value={targetAge || "—"} disabled />
              </div>
              <div className="ehr-form-group">
                <label>Number of Birds Affected</label>
                <input type="text" value={numberOfBirdsAffected} disabled />
              </div>
              <div className="ehr-form-group">
                <label>Number Mortality</label>
                <input type="text" value={numberMortality} disabled />
              </div>
              <div className="ehr-form-group">
                <label>Schedule</label>
                <input type="date" min={date || undefined} value={nextSchedule} onChange={(e) => setNextSchedule(e.target.value)} />
                <small>Synced from linked Medication/Vaccination records.</small>
              </div>
              <div className="ehr-form-group">
                <label>Treatment Applied</label>
                <input type="text" value={treatmentApplied || "—"} disabled />
                <small>Aggregated from linked Medication/Vaccination records.</small>
              </div>
            </div>

            <div className="ehr-section-header">
              <FiActivity />
              <h3>Assessment (Editable)</h3>
              <div className="ehr-line" />
            </div>

            <div className="ehr-form-grid">
              <div className="ehr-form-group">
                <label>Observation</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <select value={symptomsObserved} onChange={(e) => setSymptomsObserved(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Select observation</option>
                    {symptomsObserved && symptomsObserved !== NEW_VALUE && !observationOptions.includes(symptomsObserved) && (
                      <option value={symptomsObserved}>{symptomsObserved}</option>
                    )}
                    {observationOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    <option value={NEW_VALUE}>Others</option>
                  </select>
                  {symptomsObserved === NEW_VALUE && (
                    <input type="text" value={newSymptomsObserved} onChange={(e) => setNewSymptomsObserved(e.target.value)}
                      placeholder="Enter observation..." style={{ flex: 1 }} required />
                  )}
                </div>
                <small>Detailed symptoms observed during assessment — separate from Isolation's Symptoms/Reasons.</small>
              </div>

              <div className="ehr-form-group">
                <label>Presumptive Diagnosis</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <select value={presumptiveDiagnosis} onChange={(e) => setPresumptiveDiagnosis(e.target.value)} style={{ flex: 1 }} disabled={isolationCompleted}>
                    <option value="">Select presumptive diagnosis</option>
                    {presumptiveDiagnosis && presumptiveDiagnosis !== NEW_VALUE && !symptomOptions.includes(presumptiveDiagnosis) && (
                      <option value={presumptiveDiagnosis}>{presumptiveDiagnosis}</option>
                    )}
                    {symptomOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                    <option value={NEW_VALUE}>Others</option>
                  </select>
                  {presumptiveDiagnosis === NEW_VALUE && !isolationCompleted && (
                    <input type="text" value={newPresumptiveDiagnosis} onChange={(e) => setNewPresumptiveDiagnosis(e.target.value)}
                      placeholder="Enter presumptive diagnosis..." style={{ flex: 1 }} required />
                  )}
                </div>
                <small>{isolationCompleted
                  ? "Locked — the linked Isolation event is Completed."
                  : "Starts equal to Isolation's Symptoms/Reasons, but can be revised here as the assessment develops. Shares the same option list."}</small>
              </div>

              <div className="ehr-form-group">
                <label>Vet Diagnosis</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <select value={vetDiagnosis} onChange={(e) => setVetDiagnosis(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Select vet diagnosis</option>
                    {vetDiagnosis && vetDiagnosis !== NEW_VALUE && !vetDiagnosisOptions.includes(vetDiagnosis) && (
                      <option value={vetDiagnosis}>{vetDiagnosis}</option>
                    )}
                    {vetDiagnosisOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                    <option value={NEW_VALUE}>Others</option>
                  </select>
                  {vetDiagnosis === NEW_VALUE && (
                    <input type="text" value={newVetDiagnosis} onChange={(e) => setNewVetDiagnosis(e.target.value)}
                      placeholder="Enter vet diagnosis..." style={{ flex: 1 }} required />
                  )}
                </div>
              </div>
            </div>

            {treatments.length > 0 && (
              <>
                <div className="ehr-section-header">
                  <FiActivity />
                  <h3>Linked Medication/Vaccination History</h3>
                  <div className="ehr-line" />
                </div>
                {treatments.map((t) => (
                  <div key={t._id} className="ehr-char-count" style={{ marginBottom: 6 }}>
                    {d(t.date)}: {t.vaccineOrDrug} ({t.numberOfBirdsAdministered} birds)
                  </div>
                ))}
              </>
            )}

            <div className="ehr-section-header">
              <FiFileText />
              <h3>Additional Information</h3>
              <div className="ehr-line" />
            </div>

            <div className="ehr-form-group ehr-full-width">
              <label>Remarks / Follow-up Action</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Enter remarks or follow-up action..." maxLength={500} />
              <small className="ehr-char-count">{(remarks || "").length} / 500</small>
            </div>
          </>
        ) : (
          <>
            <div className="ehr-section-header">
              <FiDroplet />
              <h3>Diagnosis Link (Locked)</h3>
              <div className="ehr-line" />
            </div>

            <div className="ehr-form-grid">
              <div className="ehr-form-group">
                <label>Medication ID</label>
                <input type="text" value={medicationCode || "—"} disabled />
                <small>Cannot be changed.</small>
              </div>
              <div className="ehr-form-group">
                <label>Batch ID</label>
                <input type="text" value={batchId} disabled />
                <small>Cannot be changed — set when this record was created.</small>
              </div>
              <div className="ehr-form-group">
                <label>Diagnosis ID</label>
                <input type="text" value={diagnosisCode || "—"} disabled />
                <small>{diagnosisCode ? "Cannot be changed." : "Not linked to a Diagnosis — this batch was in Quarantine when recorded."}</small>
              </div>
              <div className="ehr-form-group">
                <label>Date <span className="ehr-req">*</span></label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today} required />
              </div>
            </div>

            <div className="ehr-section-header">
              <FiActivity />
              <h3>Treatment Information</h3>
              <div className="ehr-line" />
            </div>

            <div className="ehr-form-grid">
              <div className="ehr-form-group">
                <label>No. of Birds Administered <span className="ehr-req">*</span></label>
                {ongoingQuarantineHeadCount != null ? (
                  <>
                    <input type="text" value={ongoingQuarantineHeadCount} disabled />
                    <small>Automatically the batch's current Quarantine Head Count — not editable.</small>
                  </>
                ) : (
                  <input type="number" min="1" step="1" value={numberOfBirdsAdministered}
                    onChange={(e) => setNumberOfBirdsAdministered(e.target.value)} required />
                )}
              </div>
              <div className="ehr-form-group">
                <label>Vaccine / Drug <span className="ehr-req">*</span></label>
                <input type="text" value={vaccineOrDrug} onChange={(e) => setVaccineOrDrug(e.target.value)} required />
              </div>
              <div className="ehr-form-group">
                <label>Target Age / Stage</label>
                <input type="text" value={targetAge || "—"} disabled />
                <small>Auto-recomputed from the batch's Date Acquired on save.</small>
              </div>
              <div className="ehr-form-group">
                <label>Route of Administration <span className="ehr-req">*</span></label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <select value={routeOfAdmin} onChange={(e) => setRouteOfAdmin(e.target.value)} required style={{ flex: 1 }}>
                    <option value="">Select route</option>
                    {routeOfAdmin && routeOfAdmin !== NEW_VALUE && !routeChoices.includes(routeOfAdmin) && (
                      <option value={routeOfAdmin}>{routeOfAdmin}</option>
                    )}
                    {routeChoices.map((r) => <option key={r} value={r}>{r}</option>)}
                    <option value={NEW_VALUE}>Others</option>
                  </select>
                  {routeOfAdmin === NEW_VALUE && (
                    <input type="text" value={newRoute} onChange={(e) => setNewRoute(e.target.value)}
                      placeholder="Enter route..." style={{ flex: 1 }} required />
                  )}
                </div>
              </div>
              <div className="ehr-form-group">
                <label>Dosage</label>
                <input type="text" inputMode="decimal" value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="e.g. 0.5" />
              </div>
              <div className="ehr-form-group">
                <label>Unit</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <select value={dosageUnit} onChange={(e) => setDosageUnit(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Select unit</option>
                    {dosageUnit && dosageUnit !== NEW_VALUE && !unitChoices.includes(dosageUnit) && (
                      <option value={dosageUnit}>{dosageUnit}</option>
                    )}
                    {unitChoices.map((u) => <option key={u} value={u}>{u}</option>)}
                    <option value={NEW_VALUE}>Others</option>
                  </select>
                  {dosageUnit === NEW_VALUE && (
                    <input type="text" value={newUnit} onChange={(e) => setNewUnit(e.target.value)}
                      placeholder="Enter unit..." style={{ flex: 1 }} required />
                  )}
                </div>
              </div>
              <div className="ehr-form-group">
                <label>Frequency</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Select frequency</option>
                    {frequency && frequency !== NEW_VALUE && !frequencyChoices.includes(frequency) && (
                      <option value={frequency}>{frequency}</option>
                    )}
                    {frequencyChoices.map((f) => <option key={f} value={f}>{f}</option>)}
                    <option value={NEW_VALUE}>Others</option>
                  </select>
                  {frequency === NEW_VALUE && (
                    <input type="text" value={newFrequency} onChange={(e) => setNewFrequency(e.target.value)}
                      placeholder="Enter frequency..." style={{ flex: 1 }} required />
                  )}
                </div>
              </div>
            </div>

            <div className="ehr-section-header">
              <FiActivity />
              <h3>Administered By</h3>
              <div className="ehr-line" />
            </div>

            <div className="ehr-form-grid">
              <div className="ehr-form-group">
                <label>Type <span className="ehr-req">*</span></label>
                <select value={administeredByType} onChange={(e) => setAdministeredByType(e.target.value)} required>
                  <option value="">Select type</option>
                  <option value="Staff">Staff</option>
                  <option value="Vet">Vet</option>
                </select>
              </div>
              {administeredByType === "Staff" && (
                <div className="ehr-form-group">
                  <label>Staff Member <span className="ehr-req">*</span></label>
                  <select value={personnelId} onChange={(e) => setPersonnelId(e.target.value)} required>
                    <option value="">Select staff member</option>
                    {personnel.map((p) => <option key={p._id} value={p._id}>{p.user?.name || p.name || p._id}</option>)}
                  </select>
                </div>
              )}
              {administeredByType === "Vet" && (
                <div className="ehr-form-group">
                  <label>Veterinarian <span className="ehr-req">*</span></label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <select value={vetId} onChange={(e) => setVetId(e.target.value)} style={{ flex: 1 }}>
                      <option value="">Select veterinarian</option>
                      {vets.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
                      <option value={NEW_VALUE}>+ Add New Vet</option>
                    </select>
                    {(vetId === NEW_VALUE || vets.length === 0) && (
                      <input type="text" value={newVet} onChange={(e) => setNewVet(e.target.value)}
                        placeholder="Enter veterinarian name..." style={{ flex: 1 }} />
                    )}
                  </div>
                  {vets.length === 0 && <small><FiUserPlus /> No veterinarians on file yet — type a name to add one.</small>}
                </div>
              )}
            </div>

            <div className="ehr-section-header">
              <FiActivity />
              <h3>Schedules</h3>
              <div className="ehr-line" />
            </div>

            <div className="ehr-form-group ehr-full-width">
              {schedules.length > 0 ? (
                schedules.map((s, i) => <div key={i} className="ehr-char-count">{d(s)}</div>)
              ) : (
                <small>No schedules yet.</small>
              )}
              {!addingSchedule ? (
                <button type="button" className="ehr-cancel-btn" style={{ marginTop: 8 }} onClick={handleAddSchedule}>
                  <FiPlus /> Add Schedule
                </button>
              ) : (
                <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center" }}>
                  <input type="date" min={date || undefined} value={scheduleDraft} onChange={(e) => setScheduleDraft(e.target.value)} />
                  {scheduleInvalid && <small style={{ color: "#c0392b" }}>Cannot be earlier than the record date.</small>}
                </div>
              )}
              <small>Existing schedules are preserved — this adds a new follow-up date without removing old ones.</small>
            </div>

            <div className="ehr-section-header">
              <FiFileText />
              <h3>Additional Information</h3>
              <div className="ehr-line" />
            </div>

            <div className="ehr-form-group ehr-full-width">
              <label>Remarks</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Enter remarks, aftereffects, or reactions..." maxLength={500} />
              <small className="ehr-char-count">{(remarks || "").length} / 500</small>
            </div>
          </>
        )}

        <div className="ehr-form-actions">
          <p className="ehr-req-note">Fields with * are required.</p>
          <div className="ehr-action-btns">
            <button type="button" className="ehr-cancel-btn" onClick={() => navigate(`/records/health?tab=${isDiagnosis ? "diagnosis" : "vaccination"}`)}>
              <FiX /> Cancel
            </button>
            <button type="submit" className="ehr-save-btn" disabled={saving}>
              <FiSave /> {saving ? "Saving..." : "Update Record"}
            </button>
          </div>
        </div>
      </form>
    </PageLayout>
  );
}