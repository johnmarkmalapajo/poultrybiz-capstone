import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiSave, FiX, FiMenu, FiShield, FiAlertCircle, FiFileText } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./AddQuarantineIsolation.css";

const FLOCKS_API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/flocks`;
const QUARANTINE_STATUS = ["Ongoing", "Cleared", "Released"];
const ISOLATION_STATUS = ["In Isolation", "Recovered", "Deceased"];
const BREEDS = ["Hy-Line W-36", "Lohmann LSL Lite", "Dekalb White", "Shaver White", "Hendrix White"];

export default function AddQuarantineIsolation() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialType = params.get("type") === "isolation" ? "Isolation" : "Quarantine";

  const [formData, setFormData] = useState({
    recordType: initialType,
    batchId: "",
    cageId: "",
    // quarantine
    dateAcquired: "",
    source: "",
    breed: "",
    headCount: "",
    vitaminsGiven: "",
    status: "",
    releasedDate: "",
    // isolation
    dateIsolated: "",
    currentStatus: "",
    dateOfDeath: "",
    symptoms: "",
  });

  const isIsolation = formData.recordType === "Isolation";
  const backRoute = `/records/quarantine?tab=${isIsolation ? "isolation" : "quarantine"}`;

  // -- Flocks (Batch ID + Cage ID dropdowns connected to Flock Profile) --
  const [flocks, setFlocks] = useState([]);

  useEffect(() => {
    fetch(FLOCKS_API)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.records || data.flocks || [];
        setFlocks(list);
      })
      .catch(() => setFlocks([]));
  }, []);

  const batchOptions = [...new Set(flocks.map((f) => f.batchId).filter(Boolean))];
  const cageOptions  = [...new Set(flocks.map((f) => f.cageId).filter(Boolean))];

  const today = new Date().toISOString().slice(0, 10);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      // Selecting "Released" auto-fills today's date (the connected fields then transfer to Flock Profile)
      if (name === "status" && value === "Released") {
        return { ...prev, status: value, releasedDate: prev.releasedDate || today };
      }
      // Selecting "Deceased" auto-fills today's date (the connected fields then transfer to Mortality Record)
      if (name === "currentStatus" && value === "Deceased") {
        return { ...prev, currentStatus: value, dateOfDeath: prev.dateOfDeath || today };
      }
      return { ...prev, [name]: value };
    });
  };

  // Selecting a batch auto-fills cage + acquisition info + breed from the flock profile
  const handleBatchChange = (e) => {
    const batchId = e.target.value;
    const flock = flocks.find((f) => f.batchId === batchId);
    setFormData((prev) => ({
      ...prev,
      batchId,
      cageId: flock?.cageId ?? prev.cageId,
      dateAcquired: flock?.dateAcquired ?? prev.dateAcquired,
      source: flock?.source ?? prev.source,
      breed: flock?.breed ?? prev.breed,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...formData };
    // When a quarantine batch is Released, its connected fields transfer to the Flock Profile
    if (!isIsolation && formData.status === "Released") {
      payload.flockTransfer = {
        batchId: formData.batchId,
        breed: formData.breed,
        source: formData.source,
        dateAcquired: formData.dateAcquired,
        quantityPurchased: Number(formData.headCount) || 0,
        status: "Active",
        releasedDate: formData.releasedDate,
      };
    }
    // When an isolated bird is Deceased, its connected fields transfer to the Mortality Record
    if (isIsolation && formData.currentStatus === "Deceased") {
      payload.mortalityTransfer = {
        date: formData.dateOfDeath || today,
        batchId: formData.batchId,
        cageId: formData.cageId,
        numberOfMortality: 1,
        causeOfDeath: "Disease",
        suspectedDisease: "",
        remarks: formData.symptoms,
      };
    }
    console.log("Quarantine/Isolation payload:", payload);
    // API integration here later (backend creates/activates the Flock from flockTransfer)
    navigate(backRoute);
  };

  return (
    <div className="aqi-page">
      <Sidebar />

      <div className="aqi-main">

        {/* Breadcrumb */}
        <div className="aqi-breadcrumb">
          <button className="aqi-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="aqi-bc-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span className="aqi-bc-sep">›</span>
          <span className="aqi-bc-link" onClick={() => navigate(backRoute)}>QUARANTINE AND ISOLATION</span>
          <span className="aqi-bc-sep">›</span>
          <span className="aqi-bc-current">ADD {isIsolation ? "ISOLATION" : "QUARANTINE"} RECORD</span>
        </div>

        {/* Header */}
        <div className="aqi-header">
          <div>
            <h2>Add {isIsolation ? "Isolation" : "Quarantine"} Record</h2>
            <p>{isIsolation
              ? "Log a symptomatic bird placed in isolation, including its cage, batch, status, and symptoms."
              : "Log a newly arrived batch under quarantine, including source, breed, head count, and vitamins given."}</p>
          </div>
        </div>

        <form className="aqi-form-card" onSubmit={handleSubmit}>

          {/* DETAILS */}
          <div className="aqi-section-header">
            {isIsolation ? <FiAlertCircle /> : <FiShield />}
            <h3>{isIsolation ? "Isolation" : "Quarantine"} Details</h3>
            <div className="aqi-line" />
          </div>

          <div className="aqi-form-grid">
            <div className="aqi-form-group">
              <label>Record Type <span className="aqi-req">*</span></label>
              <select name="recordType" value={formData.recordType} onChange={handleChange} required>
                <option value="Quarantine">Quarantine</option>
                <option value="Isolation">Isolation</option>
              </select>
            </div>

            {/* Batch ID — both */}
            <div className="aqi-form-group">
              <label>Batch ID <span className="aqi-req">*</span></label>
              <select name="batchId" value={formData.batchId} onChange={handleBatchChange} required>
                <option value="">Select batch ID</option>
                {batchOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Cage ID — isolation only */}
            {isIsolation && (
              <div className="aqi-form-group">
                <label>Cage ID <span className="aqi-req">*</span></label>
                <select name="cageId" value={formData.cageId} onChange={handleChange} required>
                  <option value="">Select cage</option>
                  {cageOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            )}

            {/* ── QUARANTINE FIELDS ── */}
            {!isIsolation && (
              <>
                <div className="aqi-form-group">
                  <label>Date Acquired</label>
                  <input type="date" name="dateAcquired" value={formData.dateAcquired} onChange={handleChange} />
                </div>

                <div className="aqi-form-group">
                  <label>Source</label>
                  <input type="text" name="source" value={formData.source} onChange={handleChange} placeholder="e.g. Supplier name / hatchery" />
                </div>

                <div className="aqi-form-group">
                  <label>Breed <span className="aqi-req">*</span></label>
                  <select name="breed" value={formData.breed} onChange={handleChange} required>
                    <option value="">Select Breed</option>
                    {formData.breed && !BREEDS.includes(formData.breed) && (
                      <option value={formData.breed}>{formData.breed}</option>
                    )}
                    {BREEDS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                <div className="aqi-form-group">
                  <label>Head Count <span className="aqi-req">*</span></label>
                  <input type="number" min="1" name="headCount" value={formData.headCount} onChange={handleChange} placeholder="Enter head count" required />
                </div>

                <div className="aqi-form-group">
                  <label>Vitamins Given</label>
                  <input type="text" name="vitaminsGiven" value={formData.vitaminsGiven} onChange={handleChange} placeholder="e.g. Electrolytes, Vitamin C" />
                </div>

                <div className="aqi-form-group">
                  <label>Status <span className="aqi-req">*</span></label>
                  <select name="status" value={formData.status} onChange={handleChange} required>
                    <option value="">Select status</option>
                    {QUARANTINE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {formData.status === "Released" && (
                  <div className="aqi-form-group">
                    <label>Released Date <span className="aqi-req">*</span></label>
                    <input type="date" name="releasedDate" value={formData.releasedDate} onChange={handleChange} required />
                  </div>
                )}
              </>
            )}

            {/* ── ISOLATION FIELDS ── */}
            {isIsolation && (
              <>
                <div className="aqi-form-group">
                  <label>Date Isolated <span className="aqi-req">*</span></label>
                  <input type="date" name="dateIsolated" value={formData.dateIsolated} onChange={handleChange} required />
                </div>

                <div className="aqi-form-group">
                  <label>Current Status <span className="aqi-req">*</span></label>
                  <select name="currentStatus" value={formData.currentStatus} onChange={handleChange} required>
                    <option value="">Select status</option>
                    {ISOLATION_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {formData.currentStatus === "Deceased" && (
                  <div className="aqi-form-group">
                    <label>Date of Death</label>
                    <input type="date" name="dateOfDeath" value={formData.dateOfDeath || today} disabled readOnly />
                    <small>Auto-set to today and sent to the Mortality Record.</small>
                  </div>
                )}
              </>
            )}
          </div>

          {!isIsolation && formData.status === "Released" && (
            <div style={{ background: "#eaf7f1", color: "#1f7a52", border: "1.5px solid #b8e6cf",
              borderRadius: "8px", padding: "10px 14px", fontSize: "13px", fontWeight: 600,
              display: "flex", alignItems: "center", gap: "8px" }}>
              <FiShield /> On release, the connected fields (Batch ID, Breed, Source, Date Acquired, Head Count) will be transferred to the Flock Profile as an active flock.
            </div>
          )}

          {isIsolation && formData.currentStatus === "Deceased" && (
            <div style={{ background: "#fdf0f0", color: "#c0392b", border: "1.5px solid #f5c6c6",
              borderRadius: "8px", padding: "10px 14px", fontSize: "13px", fontWeight: 600,
              display: "flex", alignItems: "center", gap: "8px" }}>
              <FiAlertCircle /> On marking deceased, the connected fields (Batch ID, Cage ID, Date, Symptoms) will be transferred to the Mortality Record.
            </div>
          )}

          {/* SYMPTOMS / REASONS (isolation) — or notes for quarantine */}
          <div className="aqi-section-header">
            <FiFileText />
            <h3>{isIsolation ? "Symptoms / Reasons" : "Notes"}</h3>
            <div className="aqi-line" />
          </div>

          <div className="aqi-form-group aqi-full-width">
            <label>{isIsolation ? "Symptoms / Reasons" : "Notes"} <span className="aqi-optional">(optional)</span></label>
            <textarea
              name="symptoms"
              value={formData.symptoms}
              onChange={handleChange}
              placeholder={isIsolation ? "Describe the symptoms or reason for isolation..." : "Any notes about this quarantine batch..."}
              maxLength={255}
            />
            <div className="aqi-char-row">
              <small>{isIsolation ? "Briefly describe the symptoms or reason for isolation." : "Optional notes for this record."}</small>
              <small className="aqi-char-count">{formData.symptoms.length} / 255</small>
            </div>
          </div>

          {/* Actions */}
          <div className="aqi-form-actions">
            <p className="aqi-req-note">Fields with * are required.</p>
            <div className="aqi-action-btns">
              <button type="button" className="aqi-cancel-btn" onClick={() => navigate(backRoute)}>
                <FiX /> Cancel
              </button>
              <button type="submit" className="aqi-save-btn">
                <FiSave /> Save Record
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}