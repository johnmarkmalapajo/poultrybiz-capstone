import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FiSave, FiX, FiMenu, FiShield, FiAlertCircle, FiFileText } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./EditQuarantineandIsolation.css";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1");
const FLOCKS_API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/flocks`;
const QUARANTINE_STATUS = ["Ongoing", "Cleared", "Released"];
const ISOLATION_STATUS = ["In Isolation", "Recovered", "Deceased"];

export default function EditQuarantineIsolation() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    recordType: params.get("type") === "isolation" ? "Isolation" : "Quarantine",
    batchId: "",
    cageId: "",
    breed: "",
    dateAcquired: "",
    source: "",
    headCount: "",
    vitaminsGiven: "",
    status: "",
    releasedDate: "",
    dateIsolated: "",
    currentStatus: "",
    dateOfDeath: "",
    symptoms: "",
  });

  const [flocks, setFlocks] = useState([]);

  // ── Flocks for Batch ID + Cage ID dropdowns ──
  useEffect(() => {
    fetch(FLOCKS_API)
      .then((r) => r.json())
      .then((data) => setFlocks(Array.isArray(data) ? data : data.records || data.flocks || []))
      .catch(() => setFlocks([]));
  }, []);

  const batchOptions = [...new Set(flocks.map((f) => f.batchId).filter(Boolean))];
  const cageOptions  = [...new Set(flocks.map((f) => f.cageId).filter(Boolean))];

  // ── Fetch the existing record ──
  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/quarantine-records/${id}`, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const rec = json.record || json.data || json;
        const inferredType =
          rec.recordType ||
          (rec.dateIsolated || rec.cageId || rec.currentStatus ? "Isolation" : "Quarantine");
        setFormData((prev) => ({ ...prev, ...rec, recordType: inferredType }));
      } catch {
        // keep form as-is if fetch fails
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isIsolation = formData.recordType === "Isolation";
  const backRoute = `/records/quarantine?tab=${isIsolation ? "isolation" : "quarantine"}`;

  const today = new Date().toISOString().slice(0, 10);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (name === "status" && value === "Released") {
        return { ...prev, status: value, releasedDate: prev.releasedDate || today };
      }
      if (name === "currentStatus" && value === "Deceased") {
        return { ...prev, currentStatus: value, dateOfDeath: prev.dateOfDeath || today };
      }
      return { ...prev, [name]: value };
    });
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const payload = { ...formData };
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
    try {
      const token = localStorage.getItem("token");
      setSaving(true);
      await fetch(`${API}/quarantine-records/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
    } catch {
      setSaving(false);
      /* silent — adjust endpoint to your backend */
    }
    navigate(backRoute);
  };

  const d = (v) => (v ? String(v).slice(0, 10) : "");

  if (loading) {
    return (
      <div className="eqi-page">
        <Sidebar />
        <div className="eqi-main">
          <p style={{ color: "#aaa", fontFamily: "var(--font-body)" }}>Loading record...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="eqi-page">
      <Sidebar />

      <div className="eqi-main">

        {/* Breadcrumb */}
        <div className="eqi-breadcrumb">
          <button className="eqi-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="eqi-bc-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span className="eqi-bc-sep">›</span>
          <span className="eqi-bc-link" onClick={() => navigate(backRoute)}>QUARANTINE AND ISOLATION</span>
          <span className="eqi-bc-sep">›</span>
          <span className="eqi-bc-current">EDIT {isIsolation ? "ISOLATION" : "QUARANTINE"} RECORD</span>
        </div>

        {/* Header */}

        <form className="eqi-form-card" onSubmit={handleSubmit}>

          {/* DETAILS */}
          <div className="eqi-section-header">
            {isIsolation ? <FiAlertCircle /> : <FiShield />}
            <h3>{isIsolation ? "Isolation" : "Quarantine"} Details</h3>
            <div className="eqi-line" />
          </div>

          <div className="eqi-form-grid">
            <div className="eqi-form-group">
              <label>Record Type <span className="eqi-req">*</span></label>
              <select name="recordType" value={formData.recordType} onChange={handleChange} required>
                <option value="Quarantine">Quarantine</option>
                <option value="Isolation">Isolation</option>
              </select>
            </div>

            <div className="eqi-form-group">
              <label>Batch ID <span className="eqi-req">*</span></label>
              <select name="batchId" value={formData.batchId} onChange={handleBatchChange} required>
                <option value="">Select batch ID</option>
                {formData.batchId && !batchOptions.includes(formData.batchId) && (
                  <option value={formData.batchId}>{formData.batchId}</option>
                )}
                {batchOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {isIsolation && (
              <div className="eqi-form-group">
                <label>Cage ID <span className="eqi-req">*</span></label>
                <select name="cageId" value={formData.cageId} onChange={handleChange} required>
                  <option value="">Select cage</option>
                  {formData.cageId && !cageOptions.includes(formData.cageId) && (
                    <option value={formData.cageId}>{formData.cageId}</option>
                  )}
                  {cageOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            )}

            {/* ── QUARANTINE FIELDS ── */}
            {!isIsolation && (
              <>
                <div className="eqi-form-group">
                  <label>Breed <span className="eqi-req">*</span></label>
                  <select name="breed" value={formData.breed} onChange={handleChange} required>
                    <option value="">Select Breed</option>
                    {formData.breed && !["Hy-Line W-36", "Lohmann LSL Lite", "Dekalb White", "Shaver White", "Hendrix White"].includes(formData.breed) && (
                      <option value={formData.breed}>{formData.breed}</option>
                    )}
                    <option value="Hy-Line W-36">Hy-Line W-36</option>
                    <option value="Lohmann LSL Lite">Lohmann LSL Lite</option>
                    <option value="Dekalb White">Dekalb White</option>
                    <option value="Shaver White">Shaver White</option>
                    <option value="Hendrix White">Hendrix White</option>
                  </select>
                </div>
                <div className="eqi-form-group">
                  <label>Date Acquired</label>
                  <input type="date" name="dateAcquired" value={d(formData.dateAcquired)} onChange={handleChange} />
                </div>
                <div className="eqi-form-group">
                  <label>Source</label>
                  <input type="text" name="source" value={formData.source} onChange={handleChange} placeholder="e.g. Supplier name / hatchery" />
                </div>
                <div className="eqi-form-group">
                  <label>Head Count <span className="eqi-req">*</span></label>
                  <input type="number" min="1" name="headCount" value={formData.headCount} onChange={handleChange} required />
                </div>
                <div className="eqi-form-group">
                  <label>Vitamins Given</label>
                  <input type="text" name="vitaminsGiven" value={formData.vitaminsGiven} onChange={handleChange} placeholder="e.g. Electrolytes, Vitamin C" />
                </div>
                <div className="eqi-form-group">
                  <label>Status <span className="eqi-req">*</span></label>
                  <select name="status" value={formData.status} onChange={handleChange} required>
                    <option value="">Select status</option>
                    {QUARANTINE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {formData.status === "Released" && (
                  <div className="eqi-form-group">
                    <label>Released Date <span className="eqi-req">*</span></label>
                    <input type="date" name="releasedDate" value={d(formData.releasedDate)} onChange={handleChange} required />
                  </div>
                )}
              </>
            )}

            {/* ── ISOLATION FIELDS ── */}
            {isIsolation && (
              <>
                <div className="eqi-form-group">
                  <label>Date Isolated <span className="eqi-req">*</span></label>
                  <input type="date" name="dateIsolated" value={d(formData.dateIsolated)} onChange={handleChange} required />
                </div>
                <div className="eqi-form-group">
                  <label>Current Status <span className="eqi-req">*</span></label>
                  <select name="currentStatus" value={formData.currentStatus} onChange={handleChange} required>
                    <option value="">Select status</option>
                    {ISOLATION_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {formData.currentStatus === "Deceased" && (
                  <div className="eqi-form-group">
                    <label>Date of Death</label>
                    <input type="date" name="dateOfDeath" value={d(formData.dateOfDeath) || today} disabled readOnly />
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

          {/* SYMPTOMS / NOTES */}
          <div className="eqi-section-header">
            <FiFileText />
            <h3>{isIsolation ? "Symptoms / Reasons" : "Notes"}</h3>
            <div className="eqi-line" />
          </div>

          <div className="eqi-form-group eqi-full-width">
            <label>{isIsolation ? "Symptoms / Reasons" : "Notes"} <span className="eqi-optional">(optional)</span></label>
            <textarea
              name="symptoms"
              value={formData.symptoms || ""}
              onChange={handleChange}
              placeholder={isIsolation ? "Describe the symptoms or reason for isolation..." : "Any notes about this quarantine batch..."}
              maxLength={255}
            />
            <div className="eqi-char-row">
              <small>{isIsolation ? "Briefly describe the symptoms or reason for isolation." : "Optional notes for this record."}</small>
              <small className="eqi-char-count">{(formData.symptoms || "").length} / 255</small>
            </div>
          </div>

          {/* Actions */}
          <div className="eqi-form-actions">
            <p className="eqi-req-note">Fields with * are required.</p>
            <div className="eqi-action-btns">
              <button type="button" className="eqi-cancel-btn" onClick={() => navigate(backRoute)}>
                <FiX /> Cancel
              </button>
              <button type="submit" disabled={saving} className="eqi-save-btn">
                <FiSave /> Update Record
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
