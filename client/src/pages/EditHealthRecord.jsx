import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FiSave, FiX, FiMenu, FiActivity, FiDroplet, FiFileText, FiAlertTriangle } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./EditHealthRecord.css";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1");
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

export default function EditHealthRecord() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const [isVax, setIsVax] = useState(params.get("type") === "vaccination");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [diagnosisData, setDiagnosisData] = useState({
    recordType: "Veterinary Treatment",
    date: "", batchId: "", cageId: "",
    numberOfBirdsAffected: "", symptomsObserved: "", symptomsObservedOther: "",
    disease: "None", diseaseOther: "",
    presumptiveDiagnosis: "", presumptiveDiagnosisOther: "", vetDiagnosis: "", treatmentApplied: "",
    numberMortality: "", nextSchedule: "", remarks: "",
  });

  const [vaccinationData, setVaccinationData] = useState({
    recordType: "Vaccination",
    date: "", batchId: "", cageId: "",
    numberOfBirdsAdministered: "", vaccineOrDrug: "", targetAge: "",
    routeOfAdmin: "", dosage: "", administeredBy: "",
    nextSchedule: "", remarks: "",
  });

  const [flocks, setFlocks] = useState([]);
  const [healthRecords, setHealthRecords] = useState([]);
  const [error, setError] = useState("");

  // ── Fetch this record ──
  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/health-records/${id}`, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const rec = json.record || json.data || json;
        const vax = rec.recordType
          ? ["Vaccination", "Medication", "Vitamin Administration"].includes(rec.recordType) || rec.vaccineOrDrug != null
          : params.get("type") === "vaccination";
        setIsVax(vax);
        if (vax) setVaccinationData((prev) => ({ ...prev, ...rec }));
        else setDiagnosisData((prev) => ({ ...prev, ...rec }));
      } catch {
        // keep form
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Flocks + health records ──
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

  const isDuplicate =
    data.batchId && data.cageId && data.date &&
    healthRecords.some(
      (r) => r._id !== id && r.batchId === data.batchId && r.cageId === data.cageId &&
        r.recordType === data.recordType && r.date === data.date
    );
  const scheduleInvalid = data.nextSchedule && data.date && String(data.nextSchedule).slice(0,10) < String(data.date).slice(0,10);
  const diseaseRecorded = !isVax && !!diagnosisData.presumptiveDiagnosis;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (isDuplicate) return setError("A record already exists for this Batch + Cage + Record Type + Date.");
    if (scheduleInvalid) return setError("Next Schedule cannot be earlier than the record Date.");

    const payload = isVax
      ? { ...vaccinationData }
      : {
          ...diagnosisData,
          symptomsObserved: diagnosisData.symptomsObserved === "Others" ? diagnosisData.symptomsObservedOther : diagnosisData.symptomsObserved,
          presumptiveDiagnosis: diagnosisData.presumptiveDiagnosis === "Others" ? diagnosisData.presumptiveDiagnosisOther : diagnosisData.presumptiveDiagnosis,
        };
    try {
      const token = localStorage.getItem("token");
      setSaving(true);
      await fetch(`${API}/health-records/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
    } catch {
      setSaving(false);
      /* silent — adjust endpoint */
    }
    navigate(`/records/health?tab=${isVax ? "vaccination" : "diagnosis"}`);
  };

  const d = (v) => (v ? String(v).slice(0, 10) : "");

  const RecordTypeField = (
    <div className="ehr-form-group">
      <label>Record Type <span className="ehr-req">*</span></label>
      <select name="recordType" value={data.recordType} onChange={handleChange} required>
        {RECORD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  );
  const CageField = (
    <div className="ehr-form-group">
      <label>Cage <span className="ehr-req">*</span></label>
      <select name="cageId" value={data.cageId} onChange={handleChange} required>
        <option value="">Select Cage</option>
        {data.cageId && !cageOptions.includes(data.cageId) && <option value={data.cageId}>{data.cageId}</option>}
        {cageOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
  const NextScheduleField = (
    <div className="ehr-form-group">
      <label>Next Schedule</label>
      <input type="date" name="nextSchedule" value={d(data.nextSchedule)} min={d(data.date) || undefined} onChange={handleChange} />
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

  if (loading) {
    return (
      <div className="ehr-page">
        <Sidebar />
        <div className="ehr-main">
          <p style={{ color: "#aaa", fontFamily: "var(--font-body)" }}>Loading record...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ehr-page">
      <Sidebar />

      <div className="ehr-main">

        {/* Breadcrumb */}
        <div className="ehr-breadcrumb">
          <button className="ehr-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="ehr-bc-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span className="ehr-bc-sep">›</span>
          <span className="ehr-bc-link" onClick={() => navigate(`/records/health?tab=${isVax ? "vaccination" : "diagnosis"}`)}>HEALTH RECORD</span>
          <span className="ehr-bc-sep">›</span>
          <span className="ehr-bc-current">{isVax ? "EDIT MEDICATION/VACCINATION" : "EDIT DIAGNOSIS"}</span>
        </div>

        {/* Header */}

        {!isVax ? (
          /* ============ DIAGNOSIS FORM ============ */
          <form className="ehr-form-card" onSubmit={handleSubmit}>
            {Banners}

            <div className="ehr-section-header">
              <FiActivity />
              <h3>Diagnosis Information</h3>
              <div className="ehr-line" />
            </div>

            <div className="ehr-form-grid">
              <div className="ehr-form-group">
                <label>Date <span className="ehr-req">*</span></label>
                <input type="date" name="date" value={d(diagnosisData.date)} onChange={handleChange} required />
              </div>

              <div className="ehr-form-group">
                <label>Batch ID <span className="ehr-req">*</span></label>
                <select name="batchId" value={diagnosisData.batchId} onChange={handleChange} required>
                  <option value="">Select batch ID</option>
                  {diagnosisData.batchId && !batchOptions.includes(diagnosisData.batchId) && <option value={diagnosisData.batchId}>{diagnosisData.batchId}</option>}
                  {batchOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {CageField}

              <div className="ehr-form-group">
                <label>Number of Birds Affected <span className="ehr-req">*</span></label>
                <input type="number" min="0" name="numberOfBirdsAffected" value={diagnosisData.numberOfBirdsAffected} onChange={handleChange} placeholder="Enter number of birds" required />
              </div>

              <div className="ehr-form-group">
                <label>Disease / Observation <span className="ehr-req">*</span></label>
                <select name="symptomsObserved" value={diagnosisData.symptomsObserved} onChange={handleChange} required>
                  <option value="">Select observation</option>
                  {diagnosisData.symptomsObserved && !OBSERVATIONS.includes(diagnosisData.symptomsObserved) && diagnosisData.symptomsObserved !== "Others" && <option value={diagnosisData.symptomsObserved}>{diagnosisData.symptomsObserved}</option>}
                  {OBSERVATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  <option value="Others">Others (specify)</option>
                </select>
              </div>

              {diagnosisData.symptomsObserved === "Others" && (
                <div className="ehr-form-group">
                  <label>Specify Disease / Observation <span className="ehr-req">*</span></label>
                  <input type="text" name="symptomsObservedOther" value={diagnosisData.symptomsObservedOther} onChange={handleChange} placeholder="Enter custom observation" required />
                </div>
              )}

              <div className="ehr-form-group">
                <label>Presumptive Diagnosis</label>
                <select name="presumptiveDiagnosis" value={diagnosisData.presumptiveDiagnosis} onChange={handleChange}>
                  <option value="">Select presumptive diagnosis</option>
                  {diagnosisData.presumptiveDiagnosis && !PRESUMPTIVE_DIAGNOSES.includes(diagnosisData.presumptiveDiagnosis) && diagnosisData.presumptiveDiagnosis !== "Others" && <option value={diagnosisData.presumptiveDiagnosis}>{diagnosisData.presumptiveDiagnosis}</option>}
                  {PRESUMPTIVE_DIAGNOSES.map((dx) => <option key={dx} value={dx}>{dx}</option>)}
                  <option value="Others">Others (specify)</option>
                </select>
              </div>

              {diagnosisData.presumptiveDiagnosis === "Others" && (
                <div className="ehr-form-group">
                  <label>Specify Presumptive Diagnosis <span className="ehr-req">*</span></label>
                  <input type="text" name="presumptiveDiagnosisOther" value={diagnosisData.presumptiveDiagnosisOther} onChange={handleChange} placeholder="Enter custom diagnosis" required />
                </div>
              )}

              <div className="ehr-form-group">
                <label>Vet Diagnosis</label>
                <input type="text" name="vetDiagnosis" value={diagnosisData.vetDiagnosis} onChange={handleChange} placeholder="Enter vet diagnosis" />
              </div>

              <div className="ehr-form-group">
                <label>Treatment Applied</label>
                <input type="text" name="treatmentApplied" value={diagnosisData.treatmentApplied} onChange={handleChange} placeholder="Enter treatment applied" />
              </div>

              <div className="ehr-form-group">
                <label>Number Mortality</label>
                <input type="number" min="0" name="numberMortality" value={diagnosisData.numberMortality} onChange={handleChange} placeholder="Enter number of mortality" />
              </div>

              {NextScheduleField}
            </div>

            <div className="ehr-section-header">
              <FiFileText />
              <h3>Additional Information</h3>
              <div className="ehr-line" />
            </div>

            <div className="ehr-form-group ehr-full-width">
              <label>Remarks / Follow-up Action</label>
              <textarea name="remarks" value={diagnosisData.remarks} onChange={handleChange} placeholder="Enter remarks or follow-up action..." maxLength={500} />
              <small className="ehr-char-count">{(diagnosisData.remarks || "").length} / 500</small>
            </div>

            <div className="ehr-form-actions">
              <p className="ehr-req-note">Fields with * are required.</p>
              <div className="ehr-action-btns">
                <button type="button" className="ehr-cancel-btn" onClick={() => navigate(`/records/health?tab=diagnosis`)}>
                  <FiX /> Cancel
                </button>
                <button type="submit" className="ehr-save-btn" disabled={saving || isDuplicate || scheduleInvalid}>
                  <FiSave /> Update Record
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* ============ MEDICATION / VACCINATION FORM ============ */
          <form className="ehr-form-card" onSubmit={handleSubmit}>
            {Banners}

            {/* BATCH INFORMATION */}
            <div className="ehr-section-header">
              <FiDroplet />
              <h3>Batch Information</h3>
              <div className="ehr-line" />
            </div>

            <div className="ehr-form-grid">
              {RecordTypeField}

              <div className="ehr-form-group">
                <label>Batch <span className="ehr-req">*</span></label>
                <select name="batchId" value={vaccinationData.batchId} onChange={handleChange} required>
                  <option value="">Select batch ID</option>
                  {vaccinationData.batchId && !batchOptions.includes(vaccinationData.batchId) && <option value={vaccinationData.batchId}>{vaccinationData.batchId}</option>}
                  {batchOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {CageField}

              <div className="ehr-form-group">
                <label>Date <span className="ehr-req">*</span></label>
                <input type="date" name="date" value={d(vaccinationData.date)} onChange={handleChange} required />
              </div>
            </div>

            {/* TREATMENT INFORMATION */}
            <div className="ehr-section-header">
              <FiActivity />
              <h3>Treatment Information</h3>
              <div className="ehr-line" />
            </div>

            <div className="ehr-form-grid">
              <div className="ehr-form-group">
                <label>No. of Birds Administered <span className="ehr-req">*</span></label>
                <input type="number" min="0" name="numberOfBirdsAdministered" value={vaccinationData.numberOfBirdsAdministered} onChange={handleChange} placeholder="Enter number of birds administered" required />
              </div>

              <div className="ehr-form-group">
                <label>Vaccine / Drug <span className="ehr-req">*</span></label>
                <input type="text" name="vaccineOrDrug" value={vaccinationData.vaccineOrDrug} onChange={handleChange} placeholder="Enter vaccine or drug name" required />
              </div>

              <div className="ehr-form-group">
                <label>Target Age / Stage</label>
                <input type="text" name="targetAge" value={vaccinationData.targetAge} onChange={handleChange} placeholder="Enter target age or stage" />
              </div>

              <div className="ehr-form-group">
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

              <div className="ehr-form-group">
                <label>Dosage &amp; Frequency</label>
                <input type="text" name="dosage" value={vaccinationData.dosage} onChange={handleChange} placeholder="Enter dosage and frequency" />
              </div>

              <div className="ehr-form-group">
                <label>Administered By (Staff/Vet) <span className="ehr-req">*</span></label>
                <input type="text" name="administeredBy" value={vaccinationData.administeredBy} onChange={handleChange} placeholder="Enter staff or vet name" required />
              </div>
            </div>

            {/* SCHEDULING */}
            <div className="ehr-section-header">
              <FiActivity />
              <h3>Scheduling</h3>
              <div className="ehr-line" />
            </div>

            <div className="ehr-form-grid">
              {NextScheduleField}
            </div>

            {/* ADDITIONAL INFORMATION */}
            <div className="ehr-section-header">
              <FiFileText />
              <h3>Additional Information</h3>
              <div className="ehr-line" />
            </div>

            <div className="ehr-form-group ehr-full-width">
              <label>Remarks</label>
              <textarea name="remarks" value={vaccinationData.remarks} onChange={handleChange} placeholder="Enter remarks, aftereffects, or reactions..." maxLength={500} />
              <small className="ehr-char-count">{(vaccinationData.remarks || "").length} / 500</small>
            </div>

            <div className="ehr-form-actions">
              <p className="ehr-req-note">Fields with * are required.</p>
              <div className="ehr-action-btns">
                <button type="button" className="ehr-cancel-btn" onClick={() => navigate(`/records/health?tab=vaccination`)}>
                  <FiX /> Cancel
                </button>
                <button type="submit" className="ehr-save-btn" disabled={saving || isDuplicate || scheduleInvalid}>
                  <FiSave /> Update Record
                </button>
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
