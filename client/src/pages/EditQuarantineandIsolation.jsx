import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiSave, FiX, FiMenu, FiShield, FiFileText } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./EditQuarantineandIsolation.css";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1");

export default function EditQuarantineIsolation() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    dateStarted: "",
    batchId: "",
    numberOfBirds: "",
    status: "",
    dateEnded: "",
    reason: "",
    numberDeceased: "",
  });

  // ── Fetch the existing record ──
  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/quarantine-records/${id}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await res.json();
        const rec = json.record || json.data || json;
        setFormData((prev) => ({ ...prev, ...rec }));
      } catch {
        // keep empty form if fetch fails
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API}/quarantine-records/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
    } catch {
      /* silent — adjust endpoint to your backend */
    }
    navigate("/records/quarantine");
  };

  const isDeceased = formData.status === "Deceased";

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
          <span className="eqi-bc-link" onClick={() => navigate("/records/quarantine")}>QUARANTINE AND ISOLATION</span>
          <span className="eqi-bc-sep">›</span>
          <span className="eqi-bc-current">EDIT RECORD</span>
        </div>

        {/* Header */}
        <div className="eqi-header">
          <div>
            <h2>Edit Quarantine / Isolation Record</h2>
            <p>Update the batch, count, status, and dates for this quarantine or isolation record.</p>
          </div>
        </div>

        <form className="eqi-form-card" onSubmit={handleSubmit}>

          {/* QUARANTINE DETAILS */}
          <div className="eqi-section-header">
            <FiShield />
            <h3>Quarantine Details</h3>
            <div className="eqi-line" />
          </div>

          <div className="eqi-form-grid">
            <div className="eqi-form-group">
              <label>Date Started <span className="eqi-req">*</span></label>
              <input
                type="date"
                name="dateStarted"
                value={formData.dateStarted ? String(formData.dateStarted).slice(0, 10) : ""}
                onChange={handleChange}
                required
              />
            </div>

            <div className="eqi-form-group">
              <label>Batch ID <span className="eqi-req">*</span></label>
              <select name="batchId" value={formData.batchId} onChange={handleChange} required>
                <option value="">Select batch ID</option>
                {formData.batchId && <option value={formData.batchId}>{formData.batchId}</option>}
              </select>
            </div>

            <div className="eqi-form-group">
              <label>Number of Birds <span className="eqi-req">*</span></label>
              <input
                type="number"
                min="1"
                name="numberOfBirds"
                value={formData.numberOfBirds}
                onChange={handleChange}
                placeholder="Enter number of birds"
                required
              />
            </div>

            <div className="eqi-form-group">
              <label>Status <span className="eqi-req">*</span></label>
              <select name="status" value={formData.status} onChange={handleChange} required>
                <option value="">Select status</option>
                <option value="Isolate">Isolate</option>
                <option value="Recovered">Recovered</option>
                <option value="Deceased">Deceased</option>
              </select>
            </div>

            {/* Number Deceased — only when status is Deceased */}
            {isDeceased && (
              <div className="eqi-form-group">
                <label>Number Deceased <span className="eqi-req">*</span></label>
                <input
                  type="number"
                  min="1"
                  max={formData.numberOfBirds || undefined}
                  name="numberDeceased"
                  value={formData.numberDeceased}
                  onChange={handleChange}
                  placeholder="How many died?"
                  required
                />
              </div>
            )}

            <div className="eqi-form-group">
              <label>Date Ended <span className="eqi-req">*</span></label>
              <input
                type="date"
                name="dateEnded"
                value={formData.dateEnded ? String(formData.dateEnded).slice(0, 10) : ""}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* REASON */}
          <div className="eqi-section-header">
            <FiFileText />
            <h3>Reason</h3>
            <div className="eqi-line" />
          </div>

          <div className="eqi-form-group eqi-full-width">
            <label>Reason <span className="eqi-optional">(optional)</span></label>
            <textarea
              name="reason"
              value={formData.reason || ""}
              onChange={handleChange}
              placeholder="Enter reason for quarantine or isolation..."
              maxLength={255}
            />
            <div className="eqi-char-row">
              <small>Briefly describe the reason for quarantine or isolation.</small>
              <small className="eqi-char-count">{(formData.reason || "").length} / 255</small>
            </div>
          </div>

          {/* Actions */}
          <div className="eqi-form-actions">
            <p className="eqi-req-note">Fields with * are required.</p>
            <div className="eqi-action-btns">
              <button type="button" className="eqi-cancel-btn" onClick={() => navigate("/records/quarantine")}>
                <FiX /> Cancel
              </button>
              <button type="submit" className="eqi-save-btn">
                <FiSave /> Update Record
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}