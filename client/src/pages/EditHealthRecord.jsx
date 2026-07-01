import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FiSave, FiX, FiMenu, FiActivity, FiDroplet, FiFileText } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./EditHealthRecord.css";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1");

export default function EditHealthRecord() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  // type comes from the Edit button (?type=diagnosis | ?type=vaccination)
  const [isVax, setIsVax] = useState(params.get("type") === "vaccination");
  const [loading, setLoading] = useState(true);

  const [diagnosisData, setDiagnosisData] = useState({
    date: "",
    batchId: "",
    numberOfBirdsAffected: "",
    symptomsObserved: "",
    presumptiveDiagnosis: "",
    vetDiagnosis: "",
    treatmentApplied: "",
    numberMortality: "",
    remarks: "",
  });

  const [vaccinationData, setVaccinationData] = useState({
    date: "",
    batchId: "",
    numberOfBirdsAdministered: "",
    vaccineOrDrug: "",
    targetAge: "",
    routeOfAdmin: "",
    dosage: "",
    administeredBy: "",
    remarks: "",
  });

  // ── Fetch the existing record by id ──
  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/health-records/${id}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await res.json();
        const rec = json.record || json.data || json;

        // If the record itself tells us the type, trust it over the URL param
        const vax = rec.recordType
          ? rec.recordType === "vaccination"
          : params.get("type") === "vaccination";
        setIsVax(vax);

        if (vax) {
          setVaccinationData((prev) => ({ ...prev, ...rec }));
        } else {
          setDiagnosisData((prev) => ({ ...prev, ...rec }));
        }
      } catch {
        // keep empty form if fetch fails
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDiagnosisChange = (e) => {
    const { name, value } = e.target;
    setDiagnosisData((prev) => ({ ...prev, [name]: value }));
  };

  const handleVaccinationChange = (e) => {
    const { name, value } = e.target;
    setVaccinationData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = isVax ? vaccinationData : diagnosisData;
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API}/health-records/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      /* silent — adjust endpoint to your backend */
    }
    navigate(`/records/health?tab=${isVax ? "vaccination" : "diagnosis"}`);
  };

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
          <span className="ehr-bc-current">
            {isVax ? "EDIT MEDICATION/VACCINATION" : "EDIT DIAGNOSIS"}
          </span>
        </div>

        {/* Header */}
        <div className="ehr-header">
          <div>
            <h2>{isVax ? "Edit Medication/Vaccination Record" : "Edit Diagnosis Record"}</h2>
            <p>
              {isVax
                ? "Update the details of this vaccination or medication record."
                : "Update the details of this health diagnosis record."}
            </p>
          </div>
        </div>

        {!isVax ? (
          /* ============ DIAGNOSIS FORM ============ */
          <form className="ehr-form-card" onSubmit={handleSubmit}>

            <div className="ehr-section-header">
              <FiActivity />
              <h3>Diagnosis Information</h3>
              <div className="ehr-line" />
            </div>

            <div className="ehr-form-grid">
              <div className="ehr-form-group">
                <label>Date <span className="ehr-req">*</span></label>
                <input type="date" name="date"
                  value={diagnosisData.date} onChange={handleDiagnosisChange} required />
              </div>

              <div className="ehr-form-group">
                <label>Batch ID <span className="ehr-req">*</span></label>
                <select name="batchId" value={diagnosisData.batchId} onChange={handleDiagnosisChange} required>
                  <option value="">Select batch ID</option>
                  {diagnosisData.batchId && <option value={diagnosisData.batchId}>{diagnosisData.batchId}</option>}
                </select>
              </div>

              <div className="ehr-form-group">
                <label>Number of Birds Affected <span className="ehr-req">*</span></label>
                <input type="number" min="0" name="numberOfBirdsAffected"
                  value={diagnosisData.numberOfBirdsAffected} onChange={handleDiagnosisChange}
                  placeholder="Enter number of birds" required />
              </div>

              <div className="ehr-form-group">
                <label>Symptoms Observed <span className="ehr-req">*</span></label>
                <input type="text" name="symptomsObserved"
                  value={diagnosisData.symptomsObserved} onChange={handleDiagnosisChange}
                  placeholder="Enter symptoms observed" required />
              </div>

              <div className="ehr-form-group">
                <label>Presumptive Diagnosis</label>
                <input type="text" name="presumptiveDiagnosis"
                  value={diagnosisData.presumptiveDiagnosis} onChange={handleDiagnosisChange}
                  placeholder="Enter presumptive diagnosis" />
              </div>

              <div className="ehr-form-group">
                <label>Vet Diagnosis</label>
                <input type="text" name="vetDiagnosis"
                  value={diagnosisData.vetDiagnosis} onChange={handleDiagnosisChange}
                  placeholder="Enter vet diagnosis" />
              </div>

              <div className="ehr-form-group">
                <label>Treatment Applied</label>
                <input type="text" name="treatmentApplied"
                  value={diagnosisData.treatmentApplied} onChange={handleDiagnosisChange}
                  placeholder="Enter treatment applied" />
              </div>

              <div className="ehr-form-group">
                <label>Number Mortality</label>
                <input type="number" min="0" name="numberMortality"
                  value={diagnosisData.numberMortality} onChange={handleDiagnosisChange}
                  placeholder="Enter number of mortality" />
              </div>
            </div>

            <div className="ehr-section-header">
              <FiFileText />
              <h3>Additional Information</h3>
              <div className="ehr-line" />
            </div>

            <div className="ehr-form-group ehr-full-width">
              <label>Remarks / Follow-up Action</label>
              <textarea name="remarks"
                value={diagnosisData.remarks} onChange={handleDiagnosisChange}
                placeholder="Enter remarks or follow-up action..." maxLength={500} />
              <small className="ehr-char-count">{(diagnosisData.remarks || "").length} / 500</small>
            </div>

            <div className="ehr-form-actions">
              <p className="ehr-req-note">Fields with * are required.</p>
              <div className="ehr-action-btns">
                <button type="button" className="ehr-cancel-btn" onClick={() => navigate(`/records/health?tab=${isVax ? "vaccination" : "diagnosis"}`)}>
                  <FiX /> Cancel
                </button>
                <button type="submit" className="ehr-save-btn">
                  <FiSave /> Update Record
                </button>
              </div>
            </div>

          </form>
        ) : (
          /* ============ MEDICATION / VACCINATION FORM ============ */
          <form className="ehr-form-card" onSubmit={handleSubmit}>

            <div className="ehr-section-header">
              <FiDroplet />
              <h3>Vaccination Information</h3>
              <div className="ehr-line" />
            </div>

            <div className="ehr-form-grid">
              <div className="ehr-form-group">
                <label>Date <span className="ehr-req">*</span></label>
                <input type="date" name="date"
                  value={vaccinationData.date} onChange={handleVaccinationChange} required />
              </div>

              <div className="ehr-form-group">
                <label>Batch ID <span className="ehr-req">*</span></label>
                <select name="batchId" value={vaccinationData.batchId} onChange={handleVaccinationChange} required>
                  <option value="">Select batch ID</option>
                  {vaccinationData.batchId && <option value={vaccinationData.batchId}>{vaccinationData.batchId}</option>}
                </select>
              </div>

              <div className="ehr-form-group">
                <label>Number of Birds Administered <span className="ehr-req">*</span></label>
                <input type="number" min="0" name="numberOfBirdsAdministered"
                  value={vaccinationData.numberOfBirdsAdministered} onChange={handleVaccinationChange}
                  placeholder="Enter number of birds administered" required />
              </div>

              <div className="ehr-form-group">
                <label>Name of Vaccine/Drug <span className="ehr-req">*</span></label>
                <input type="text" name="vaccineOrDrug"
                  value={vaccinationData.vaccineOrDrug} onChange={handleVaccinationChange}
                  placeholder="Enter vaccine or drug name" required />
              </div>

              <div className="ehr-form-group">
                <label>Target Age / Stage</label>
                <input type="text" name="targetAge"
                  value={vaccinationData.targetAge} onChange={handleVaccinationChange}
                  placeholder="Enter target age or stage" />
              </div>

              <div className="ehr-form-group">
                <label>Route of Administration</label>
                <select name="routeOfAdmin" value={vaccinationData.routeOfAdmin} onChange={handleVaccinationChange}>
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
                <input type="text" name="dosage"
                  value={vaccinationData.dosage} onChange={handleVaccinationChange}
                  placeholder="Enter dosage and frequency" />
              </div>

              <div className="ehr-form-group">
                <label>Administered By (Staff/Vet) <span className="ehr-req">*</span></label>
                <select name="administeredBy" value={vaccinationData.administeredBy} onChange={handleVaccinationChange} required>
                  <option value="">Select staff or vet</option>
                  {vaccinationData.administeredBy && <option value={vaccinationData.administeredBy}>{vaccinationData.administeredBy}</option>}
                </select>
              </div>
            </div>

            <div className="ehr-section-header">
              <FiFileText />
              <h3>Additional Information</h3>
              <div className="ehr-line" />
            </div>

            <div className="ehr-form-group ehr-full-width">
              <label>Remarks / Aftereffects / Reactions / Next Schedule</label>
              <textarea name="remarks"
                value={vaccinationData.remarks} onChange={handleVaccinationChange}
                placeholder="Enter remarks, aftereffects, reactions, or next schedule..." maxLength={500} />
              <small className="ehr-char-count">{(vaccinationData.remarks || "").length} / 500</small>
            </div>

            <div className="ehr-form-actions">
              <p className="ehr-req-note">Fields with * are required.</p>
              <div className="ehr-action-btns">
                <button type="button" className="ehr-cancel-btn" onClick={() => navigate(`/records/health?tab=${isVax ? "vaccination" : "diagnosis"}`)}>
                  <FiX /> Cancel
                </button>
                <button type="submit" className="ehr-save-btn">
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