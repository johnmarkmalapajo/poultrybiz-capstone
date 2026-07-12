import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiSave, FiX, FiMenu, FiActivity, FiDroplet, FiFileText, FiAlertTriangle } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./AddHealthRecord.css";

const FLOCKS_API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/flocks`;
const HEALTH_API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/health-records`;

const RECORD_TYPES = ["Health Observation", "Vitamin Administration", "Vaccination", "Medication", "Veterinary Treatment"];
const DISEASES = ["None", "Sipon", "Bulutong", "Malaria", "Prolapse", "Others"];
const OBSERVATIONS = [
  "Sneezing / Coughing",
  "Nasal Discharge",
  "Watery Eyes / Swelling Around Eyes",
  "Ruffled Feathers",
  "Drop in Feed Intake",
  "Drop in Water Intake",
  "Drop in Egg Production",
  "Soft-shelled or Misshaped Eggs",
  "Lethargy / Weakness",
  "Diarrhea (watery / greenish / bloody)",
  "Nervous Signs (twisting neck, paralysis, tremors)",
  "Sudden Death",
];
const PRESUMPTIVE_DIAGNOSES = [
  "Newcastle Disease (ND) – coughing, sneezing, green diarrhea, twisted neck",
  "Infectious Bronchitis (IB) – watery eyes, sneezing, reduced egg production",
  "Avian Influenza (AI) – sudden death, swollen face, purple comb/wattles, diarrhea",
  "Fowl Cholera – sudden death, swollen joints, nasal discharge",
  "Infectious Coryza – swelling of face, foul-smelling nasal discharge",
  "Gumboro / Infectious Bursal Disease (IBD) – ruffled feathers, trembling, watery diarrhea (young birds)",
  "Marek's Disease – paralysis, weight loss, gray eyes (in older chickens)",
  "Fowl Pox – scabs/lesions on comb, wattles, eyelids, diphtheritic plaques in mouth",
  "Coccidiosis – bloody diarrhea, drooping wings, weakness",
  "Salmonellosis / Pullorum – white diarrhea in chicks, high mortality",
  "Aspergillosis – gasping, respiratory distress, poor growth (fungal infection)",
  "E. coli / Colibacillosis – diarrhea, weakness, septicemia signs",
];
const CAGES = Array.from({ length: 12 }, (_, i) => `C-${String(i + 1).padStart(2, "0")}`);
const flockCages = (f) => f.assignedCages || (f.cageId ? [f.cageId] : []);

export default function AddHealthRecord() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isVax = params.get("type") === "vaccination";

  const [diagnosisData, setDiagnosisData] = useState({
    recordType: "Veterinary Treatment",
    date: "",
    batchId: "",
    cageId: "",
    numberOfBirdsAffected: "",
    symptomsObserved: "",
    symptomsObservedOther: "",
    disease: "None",
    diseaseOther: "",
    presumptiveDiagnosis: "",
    presumptiveDiagnosisOther: "",
    vetDiagnosis: "",
    treatmentApplied: "",
    numberMortality: "",
    nextSchedule: "",
    remarks: "",
  });

  const [vaccinationData, setVaccinationData] = useState({
    recordType: "Vaccination",
    date: "",
    batchId: "",
    cageId: "",
    numberOfBirdsAdministered: "",
    vaccineOrDrug: "",
    targetAge: "",
    routeOfAdmin: "",
    dosage: "",
    administeredBy: "",
    nextSchedule: "",
    remarks: "",
  });

  const [flocks, setFlocks] = useState([]);
  const [healthRecords, setHealthRecords] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(FLOCKS_API).then((r) => r.json())
      .then((d) => setFlocks(Array.isArray(d) ? d : d.records || d.flocks || []))
      .catch(() => setFlocks([]));
    fetch(HEALTH_API).then((r) => r.json())
      .then((d) => setHealthRecords(Array.isArray(d) ? d : d.records || d.data || []))
      .catch(() => setHealthRecords([]));
  }, []);

  const data = isVax ? vaccinationData : diagnosisData;
  const setData = isVax ? setVaccinationData : setDiagnosisData;

  const batchOptions = [...new Set(flocks.map((f) => f.batchId).filter(Boolean))];
  const selectedFlock = flocks.find((f) => f.batchId === data.batchId);
  const cageOptions = CAGES;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData((prev) => (name === "batchId" ? { ...prev, batchId: value, cageId: "" } : { ...prev, [name]: value }));
    setError("");
  };

  // ── Validation helpers ──
  const isDuplicate =
    data.batchId && data.cageId && data.date &&
    healthRecords.some(
      (r) => r.batchId === data.batchId && r.cageId === data.cageId &&
        r.recordType === data.recordType && r.date === data.date
    );
  const scheduleInvalid = data.nextSchedule && data.date && data.nextSchedule < data.date;
  const diseaseRecorded = !isVax && !!diagnosisData.presumptiveDiagnosis;
  const [saving, setSaving] = useState(false);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (isDuplicate)
      return setError("A record already exists for this Batch + Cage + Record Type + Date.");
    if (scheduleInvalid)
      return setError("Next Schedule cannot be earlier than the record Date.");

    const payload = isVax
      ? { ...vaccinationData }
      : {
          ...diagnosisData,
          symptomsObserved: diagnosisData.symptomsObserved === "Others" ? diagnosisData.symptomsObservedOther : diagnosisData.symptomsObserved,
          presumptiveDiagnosis: diagnosisData.presumptiveDiagnosis === "Others" ? diagnosisData.presumptiveDiagnosisOther : diagnosisData.presumptiveDiagnosis,
        };
    console.log("Health payload:", payload);
    // API integration later
    if (window.__pbSaving) return;  // prevent duplicate submissions
    window.__pbSaving = true;
    try {
      setSaving(true);
      await fetch(`${HEALTH_API}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setSaving(false); /* saving is local (mock API) — ignore network errors */ }
    finally { window.__pbSaving = false; }

    navigate(`/records/health?tab=${isVax ? "vaccination" : "diagnosis"}`);
  };

  // shared field blocks
  const RecordTypeField = (
    <div className={isVax ? "ahr-form-group" : "ahr-form-group"}>
      <label>Record Type <span className="ahr-req">*</span></label>
      <select name="recordType" value={data.recordType} onChange={handleChange} required>
        {RECORD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  );

  const CageField = (
    <div className="ahr-form-group">
      <label>Cage <span className="ahr-req">*</span></label>
      <select name="cageId" value={data.cageId} onChange={handleChange} required>
        <option value="">Select Cage</option>
        {cageOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <small>Select a cage (C-01 to C-12).</small>
    </div>
  );

  const NextScheduleField = (
    <div className="ahr-form-group">
      <label>Next Schedule</label>
      <input type="date" name="nextSchedule" value={data.nextSchedule} min={data.date || undefined} onChange={handleChange} />
      {scheduleInvalid && <small style={{ color: "#c0392b" }}>Cannot be earlier than the record date.</small>}
    </div>
  );

  const Banners = (
    <>
      {error && (
        <div style={{ background: "#fdf0f0", color: "#c0392b", border: "1.5px solid #f5c6c6",
          borderRadius: "8px", padding: "10px 14px", fontSize: "13px", fontWeight: 600 }}>{error}</div>
      )}
      {isDuplicate && (
        <div style={{ background: "#fff8e1", color: "#856404", border: "1.5px solid #ffe08a",
          borderRadius: "8px", padding: "10px 14px", fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
          <FiAlertTriangle /> A record already exists for this Batch + Cage + Record Type + Date.
        </div>
      )}
      {diseaseRecorded && (
        <div style={{ background: "#fdf0f0", color: "#c0392b", border: "1.5px solid #f5c6c6",
          borderRadius: "8px", padding: "10px 14px", fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
          <FiAlertTriangle /> Health Alert: A disease was recorded. Veterinary consultation is recommended.
        </div>
      )}
    </>
  );

  return (
    <div className="ahr-page">
      <Sidebar />

      <div className="ahr-main">

        {/* Breadcrumb */}
        <div className="ahr-breadcrumb">
          <button className="ahr-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="ahr-bc-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span className="ahr-bc-sep">›</span>
          <span className="ahr-bc-link" onClick={() => navigate(`/records/health?tab=${isVax ? "vaccination" : "diagnosis"}`)}>HEALTH RECORD</span>
          <span className="ahr-bc-sep">›</span>
          <span className="ahr-bc-current">{isVax ? "ADD MEDICATION/VACCINATION" : "ADD DIAGNOSIS"}</span>
        </div>

        {/* Header */}

        {!isVax ? (
          /* ============ DIAGNOSIS FORM ============ */
          <form className="ahr-form-card" onSubmit={handleSubmit}>
            {Banners}

            <div className="ahr-section-header">
              <FiActivity />
              <h3>Diagnosis Information</h3>
              <div className="ahr-line" />
            </div>

            <div className="ahr-form-grid">
              <div className="ahr-form-group">
                <label>Date <span className="ahr-req">*</span></label>
                <input type="date" name="date" value={diagnosisData.date} onChange={handleChange} required />
              </div>

              <div className="ahr-form-group">
                <label>Batch ID <span className="ahr-req">*</span></label>
                <select name="batchId" value={diagnosisData.batchId} onChange={handleChange} required>
                  <option value="">Select batch ID</option>
                  {batchOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {CageField}

              <div className="ahr-form-group">
                <label>Number of Birds Affected <span className="ahr-req">*</span></label>
                <input type="number" min="0" name="numberOfBirdsAffected"
                  value={diagnosisData.numberOfBirdsAffected} onChange={handleChange}
                  placeholder="Enter number of birds" required />
              </div>

              <div className="ahr-form-group">
                <label>Disease / Observation <span className="ahr-req">*</span></label>
                <select name="symptomsObserved" value={diagnosisData.symptomsObserved}
                  onChange={handleChange} required>
                  <option value="">Select observation</option>
                  {OBSERVATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  <option value="Others">Others (specify)</option>
                </select>
              </div>

              {diagnosisData.symptomsObserved === "Others" && (
                <div className="ahr-form-group">
                  <label>Specify Disease / Observation <span className="ahr-req">*</span></label>
                  <input type="text" name="symptomsObservedOther" value={diagnosisData.symptomsObservedOther}
                    onChange={handleChange} placeholder="Enter custom observation" required />
                </div>
              )}

              <div className="ahr-form-group">
                <label>Presumptive Diagnosis</label>
                <select name="presumptiveDiagnosis" value={diagnosisData.presumptiveDiagnosis}
                  onChange={handleChange}>
                  <option value="">Select presumptive diagnosis</option>
                  {PRESUMPTIVE_DIAGNOSES.map((dx) => <option key={dx} value={dx}>{dx}</option>)}
                  <option value="Others">Others (specify)</option>
                </select>
              </div>

              {diagnosisData.presumptiveDiagnosis === "Others" && (
                <div className="ahr-form-group">
                  <label>Specify Presumptive Diagnosis <span className="ahr-req">*</span></label>
                  <input type="text" name="presumptiveDiagnosisOther" value={diagnosisData.presumptiveDiagnosisOther}
                    onChange={handleChange} placeholder="Enter custom diagnosis" required />
                </div>
              )}

              <div className="ahr-form-group">
                <label>Vet Diagnosis</label>
                <input type="text" name="vetDiagnosis" value={diagnosisData.vetDiagnosis}
                  onChange={handleChange} placeholder="Enter vet diagnosis" />
              </div>

              <div className="ahr-form-group">
                <label>Treatment Applied</label>
                <input type="text" name="treatmentApplied" value={diagnosisData.treatmentApplied}
                  onChange={handleChange} placeholder="Enter treatment applied" />
              </div>

              <div className="ahr-form-group">
                <label>Number Mortality</label>
                <input type="number" min="0" name="numberMortality" value={diagnosisData.numberMortality}
                  onChange={handleChange} placeholder="Enter number of mortality" />
              </div>

              {NextScheduleField}
            </div>

            <div className="ahr-section-header">
              <FiFileText />
              <h3>Additional Information</h3>
              <div className="ahr-line" />
            </div>

            <div className="ahr-form-group ahr-full-width">
              <label>Remarks / Follow-up Action</label>
              <textarea name="remarks" value={diagnosisData.remarks} onChange={handleChange}
                placeholder="Enter remarks or follow-up action..." maxLength={500} />
              <small className="ahr-char-count">{diagnosisData.remarks.length} / 500</small>
            </div>

            <div className="ahr-form-actions">
              <p className="ahr-req-note">Fields with * are required.</p>
              <div className="ahr-action-btns">
                <button type="button" className="ahr-cancel-btn" onClick={() => navigate(`/records/health?tab=diagnosis`)}>
                  <FiX /> Cancel
                </button>
                <button type="submit" className="ahr-save-btn" disabled={isDuplicate || scheduleInvalid} disabled={saving}>
                  <FiSave /> Save Record
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* ============ MEDICATION / VACCINATION FORM ============ */
          <form className="ahr-form-card" onSubmit={handleSubmit}>
            {Banners}

            {/* BATCH INFORMATION */}
            <div className="ahr-section-header">
              <FiDroplet />
              <h3>Batch Information</h3>
              <div className="ahr-line" />
            </div>

            <div className="ahr-form-grid">
              {RecordTypeField}

              <div className="ahr-form-group">
                <label>Batch <span className="ahr-req">*</span></label>
                <select name="batchId" value={vaccinationData.batchId} onChange={handleChange} required>
                  <option value="">Select batch ID</option>
                  {batchOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {CageField}

              <div className="ahr-form-group">
                <label>Date <span className="ahr-req">*</span></label>
                <input type="date" name="date" value={vaccinationData.date} onChange={handleChange} required />
              </div>
            </div>

            {/* TREATMENT INFORMATION */}
            <div className="ahr-section-header">
              <FiActivity />
              <h3>Treatment Information</h3>
              <div className="ahr-line" />
            </div>

            <div className="ahr-form-grid">
              <div className="ahr-form-group">
                <label>No. of Birds Administered <span className="ahr-req">*</span></label>
                <input type="number" min="0" name="numberOfBirdsAdministered"
                  value={vaccinationData.numberOfBirdsAdministered} onChange={handleChange}
                  placeholder="Enter number of birds administered" required />
              </div>

              <div className="ahr-form-group">
                <label>Vaccine / Drug <span className="ahr-req">*</span></label>
                <input type="text" name="vaccineOrDrug" value={vaccinationData.vaccineOrDrug}
                  onChange={handleChange} placeholder="Enter vaccine or drug name" required />
              </div>

              <div className="ahr-form-group">
                <label>Target Age / Stage</label>
                <input type="text" name="targetAge" value={vaccinationData.targetAge}
                  onChange={handleChange} placeholder="Enter target age or stage" />
              </div>

              <div className="ahr-form-group">
                <label>Route</label>
                <select name="routeOfAdmin" value={vaccinationData.routeOfAdmin} onChange={handleChange}>
                  <option value="">Select route</option>
                  <option value="Oral">Oral</option>
                  <option value="Oral (Drinking Water)">Oral (Drinking Water)</option>
                  <option value="Injection (SC)">Injection (SC)</option>
                  <option value="Injection (IM)">Injection (IM)</option>
                  <option value="Spray">Spray</option>
                  <option value="Eye Drop">Eye Drop</option>
                </select>
              </div>

              <div className="ahr-form-group">
                <label>Dosage &amp; Frequency</label>
                <input type="text" name="dosage" value={vaccinationData.dosage}
                  onChange={handleChange} placeholder="Enter dosage and frequency" />
              </div>

              <div className="ahr-form-group">
                <label>Administered By (Staff/Vet) <span className="ahr-req">*</span></label>
                <input type="text" name="administeredBy" value={vaccinationData.administeredBy}
                  onChange={handleChange} placeholder="Enter staff or vet name" required />
              </div>
            </div>

            {/* SCHEDULING */}
            <div className="ahr-section-header">
              <FiActivity />
              <h3>Scheduling</h3>
              <div className="ahr-line" />
            </div>

            <div className="ahr-form-grid">
              {NextScheduleField}
            </div>

            {/* ADDITIONAL INFORMATION */}
            <div className="ahr-section-header">
              <FiFileText />
              <h3>Additional Information</h3>
              <div className="ahr-line" />
            </div>

            <div className="ahr-form-group ahr-full-width">
              <label>Remarks</label>
              <textarea name="remarks" value={vaccinationData.remarks} onChange={handleChange}
                placeholder="Enter remarks, aftereffects, or reactions..." maxLength={500} />
              <small className="ahr-char-count">{vaccinationData.remarks.length} / 500</small>
            </div>

            <div className="ahr-form-actions">
              <p className="ahr-req-note">Fields with * are required.</p>
              <div className="ahr-action-btns">
                <button type="button" className="ahr-cancel-btn" onClick={() => navigate(`/records/health?tab=vaccination`)}>
                  <FiX /> Cancel
                </button>
                <button type="submit" className="ahr-save-btn" disabled={isDuplicate || scheduleInvalid}>
                  <FiSave /> Save Record
                </button>
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
