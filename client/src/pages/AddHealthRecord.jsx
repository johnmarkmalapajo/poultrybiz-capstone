import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiSave, FiX, FiMenu, FiActivity, FiDroplet, FiFileText } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./AddHealthRecord.css";

export default function AddHealthRecord() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isVax = params.get("type") === "vaccination";

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

  const handleDiagnosisChange = (e) => {
    const { name, value } = e.target;
    setDiagnosisData((prev) => ({ ...prev, [name]: value }));
  };

  const handleVaccinationChange = (e) => {
    const { name, value } = e.target;
    setVaccinationData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // const payload = isVax ? vaccinationData : diagnosisData;
    // API integration later (POST diagnosis or vaccination based on isVax)
    navigate(`/records/health?tab=${isVax ? "vaccination" : "diagnosis"}`);
  };

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
          <span className="ahr-bc-current">
            {isVax ? "ADD MEDICATION/VACCINATION" : "ADD DIAGNOSIS"}
          </span>
        </div>

        {/* Header */}
        <div className="ahr-header">
          <div>
            <h2>{isVax ? "Add Medication/Vaccination Record" : "Add Diagnosis Record"}</h2>
            <p>
              {isVax
                ? "Log a vaccination or medication administered to a flock, including dosage, route, and the personnel responsible."
                : "Log a health diagnosis for a flock, including observed symptoms, vet findings, treatment applied, and mortality."}
            </p>
          </div>
        </div>

        {!isVax ? (
          /* ============ DIAGNOSIS FORM ============ */
          <form className="ahr-form-card" onSubmit={handleSubmit}>

            <div className="ahr-section-header">
              <FiActivity />
              <h3>Diagnosis Information</h3>
              <div className="ahr-line" />
            </div>

            <div className="ahr-form-grid">
              <div className="ahr-form-group">
                <label>Date <span className="ahr-req">*</span></label>
                <input type="date" name="date"
                  value={diagnosisData.date} onChange={handleDiagnosisChange} required />
              </div>

              <div className="ahr-form-group">
                <label>Batch ID <span className="ahr-req">*</span></label>
                <select name="batchId" value={diagnosisData.batchId} onChange={handleDiagnosisChange} required>
                  <option value="">Select batch ID</option>
                </select>
              </div>

              <div className="ahr-form-group">
                <label>Number of Birds Affected <span className="ahr-req">*</span></label>
                <input type="number" min="0" name="numberOfBirdsAffected"
                  value={diagnosisData.numberOfBirdsAffected} onChange={handleDiagnosisChange}
                  placeholder="Enter number of birds" required />
              </div>

              <div className="ahr-form-group">
                <label>Symptoms Observed <span className="ahr-req">*</span></label>
                <input type="text" name="symptomsObserved"
                  value={diagnosisData.symptomsObserved} onChange={handleDiagnosisChange}
                  placeholder="Enter symptoms observed" required />
              </div>

              <div className="ahr-form-group">
                <label>Presumptive Diagnosis</label>
                <input type="text" name="presumptiveDiagnosis"
                  value={diagnosisData.presumptiveDiagnosis} onChange={handleDiagnosisChange}
                  placeholder="Enter presumptive diagnosis" />
              </div>

              <div className="ahr-form-group">
                <label>Vet Diagnosis</label>
                <input type="text" name="vetDiagnosis"
                  value={diagnosisData.vetDiagnosis} onChange={handleDiagnosisChange}
                  placeholder="Enter vet diagnosis" />
              </div>

              <div className="ahr-form-group">
                <label>Treatment Applied</label>
                <input type="text" name="treatmentApplied"
                  value={diagnosisData.treatmentApplied} onChange={handleDiagnosisChange}
                  placeholder="Enter treatment applied" />
              </div>

              <div className="ahr-form-group">
                <label>Number Mortality</label>
                <input type="number" min="0" name="numberMortality"
                  value={diagnosisData.numberMortality} onChange={handleDiagnosisChange}
                  placeholder="Enter number of mortality" />
              </div>
            </div>

            <div className="ahr-section-header">
              <FiFileText />
              <h3>Additional Information</h3>
              <div className="ahr-line" />
            </div>

            <div className="ahr-form-group ahr-full-width">
              <label>Remarks / Follow-up Action</label>
              <textarea name="remarks"
                value={diagnosisData.remarks} onChange={handleDiagnosisChange}
                placeholder="Enter remarks or follow-up action..." maxLength={500} />
              <small className="ahr-char-count">{diagnosisData.remarks.length} / 500</small>
            </div>

            <div className="ahr-form-actions">
              <p className="ahr-req-note">Fields with * are required.</p>
              <div className="ahr-action-btns">
                <button type="button" className="ahr-cancel-btn" onClick={() => navigate(`/records/health?tab=${isVax ? "vaccination" : "diagnosis"}`)}>
                  <FiX /> Cancel
                </button>
                <button type="submit" className="ahr-save-btn">
                  <FiSave /> Save Record
                </button>
              </div>
            </div>

          </form>
        ) : (
          /* ============ MEDICATION / VACCINATION FORM ============ */
          <form className="ahr-form-card" onSubmit={handleSubmit}>

            <div className="ahr-section-header">
              <FiDroplet />
              <h3>Vaccination Information</h3>
              <div className="ahr-line" />
            </div>

            <div className="ahr-form-grid">
              <div className="ahr-form-group">
                <label>Date <span className="ahr-req">*</span></label>
                <input type="date" name="date"
                  value={vaccinationData.date} onChange={handleVaccinationChange} required />
              </div>

              <div className="ahr-form-group">
                <label>Batch ID <span className="ahr-req">*</span></label>
                <select name="batchId" value={vaccinationData.batchId} onChange={handleVaccinationChange} required>
                  <option value="">Select batch ID</option>
                </select>
              </div>

              <div className="ahr-form-group">
                <label>Number of Birds Administered <span className="ahr-req">*</span></label>
                <input type="number" min="0" name="numberOfBirdsAdministered"
                  value={vaccinationData.numberOfBirdsAdministered} onChange={handleVaccinationChange}
                  placeholder="Enter number of birds administered" required />
              </div>

              <div className="ahr-form-group">
                <label>Name of Vaccine/Drug <span className="ahr-req">*</span></label>
                <input type="text" name="vaccineOrDrug"
                  value={vaccinationData.vaccineOrDrug} onChange={handleVaccinationChange}
                  placeholder="Enter vaccine or drug name" required />
              </div>

              <div className="ahr-form-group">
                <label>Target Age / Stage</label>
                <input type="text" name="targetAge"
                  value={vaccinationData.targetAge} onChange={handleVaccinationChange}
                  placeholder="Enter target age or stage" />
              </div>

              <div className="ahr-form-group">
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

              <div className="ahr-form-group">
                <label>Dosage &amp; Frequency</label>
                <input type="text" name="dosage"
                  value={vaccinationData.dosage} onChange={handleVaccinationChange}
                  placeholder="Enter dosage and frequency" />
              </div>

              <div className="ahr-form-group">
                <label>Administered By (Staff/Vet) <span className="ahr-req">*</span></label>
                <select name="administeredBy" value={vaccinationData.administeredBy} onChange={handleVaccinationChange} required>
                  <option value="">Select staff or vet</option>
                </select>
              </div>
            </div>

            <div className="ahr-section-header">
              <FiFileText />
              <h3>Additional Information</h3>
              <div className="ahr-line" />
            </div>

            <div className="ahr-form-group ahr-full-width">
              <label>Remarks / Aftereffects / Reactions / Next Schedule</label>
              <textarea name="remarks"
                value={vaccinationData.remarks} onChange={handleVaccinationChange}
                placeholder="Enter remarks, aftereffects, reactions, or next schedule..." maxLength={500} />
              <small className="ahr-char-count">{vaccinationData.remarks.length} / 500</small>
            </div>

            <div className="ahr-form-actions">
              <p className="ahr-req-note">Fields with * are required.</p>
              <div className="ahr-action-btns">
                <button type="button" className="ahr-cancel-btn" onClick={() => navigate(`/records/health?tab=${isVax ? "vaccination" : "diagnosis"}`)}>
                  <FiX /> Cancel
                </button>
                <button type="submit" className="ahr-save-btn">
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