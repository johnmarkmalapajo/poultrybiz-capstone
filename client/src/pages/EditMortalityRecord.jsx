import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiSave, FiX, FiMenu, FiHeart, FiFileText } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./EditMortalityRecord.css";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1");

export default function EditMortalityRecord() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    date: "",
    batchId: "",
    numberOfMortality: "",
    causeOfDeath: "",
    remarks: "",
  });

  // ── Fetch the existing record ──
  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/mortality-records/${id}`, {
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
      await fetch(`${API}/mortality-records/${id}`, {
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
    navigate("/records/mortality");
  };

  if (loading) {
    return (
      <div className="emr-page">
        <Sidebar />
        <div className="emr-main">
          <p style={{ color: "#aaa", fontFamily: "var(--font-body)" }}>Loading record...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="emr-page">
      <Sidebar />

      <div className="emr-main">

        {/* Breadcrumb */}
        <div className="emr-breadcrumb">
          <button className="emr-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="emr-bc-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span className="emr-bc-sep">›</span>
          <span className="emr-bc-link" onClick={() => navigate("/records/mortality")}>MORTALITY RECORD</span>
          <span className="emr-bc-sep">›</span>
          <span className="emr-bc-current">EDIT MORTALITY</span>
        </div>

        {/* Header */}
        <div className="emr-header">
          <div>
            <h2>Edit Mortality Record</h2>
            <p>Update the details of this mortality record.</p>
          </div>
        </div>

        <form className="emr-form-card" onSubmit={handleSubmit}>

          {/* MORTALITY DETAILS */}
          <div className="emr-section-header">
            <FiHeart />
            <h3>Mortality Details</h3>
            <div className="emr-line" />
          </div>

          <div className="emr-form-grid">
            <div className="emr-form-group">
              <label>Date <span className="emr-req">*</span></label>
              <input type="date" name="date" value={formData.date} onChange={handleChange} required />
            </div>

            <div className="emr-form-group">
              <label>Batch ID <span className="emr-req">*</span></label>
              <select name="batchId" value={formData.batchId} onChange={handleChange} required>
                <option value="">Select batch ID</option>
                {formData.batchId && <option value={formData.batchId}>{formData.batchId}</option>}
              </select>
            </div>

            <div className="emr-form-group">
              <label>Number of Mortality <span className="emr-req">*</span></label>
              <input type="number" min="1" name="numberOfMortality"
                value={formData.numberOfMortality} onChange={handleChange}
                placeholder="Enter number of mortality" required />
            </div>

            <div className="emr-form-group">
              <label>Cause of Death <span className="emr-req">*</span></label>
              <select name="causeOfDeath" value={formData.causeOfDeath} onChange={handleChange} required>
                <option value="">Select cause of death</option>
                <option value="Disease">Disease</option>
                <option value="Heat Stress">Heat Stress</option>
                <option value="Injury">Injury</option>
                <option value="Weak Chicks">Weak Chicks</option>
                <option value="Unknown">Unknown</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* ADDITIONAL INFORMATION */}
          <div className="emr-section-header">
            <FiFileText />
            <h3>Additional Information</h3>
            <div className="emr-line" />
          </div>

          <div className="emr-form-group emr-full-width">
            <label>Remarks / Observations</label>
            <textarea name="remarks"
              value={formData.remarks} onChange={handleChange}
              placeholder="Enter remarks or observations..." maxLength={500} />
            <small className="emr-char-count">{(formData.remarks || "").length} / 500</small>
          </div>

          {/* Actions */}
          <div className="emr-form-actions">
            <p className="emr-req-note">Fields with * are required.</p>
            <div className="emr-action-btns">
              <button type="button" className="emr-cancel-btn" onClick={() => navigate("/records/mortality")}>
                <FiX /> Cancel
              </button>
              <button type="submit" className="emr-save-btn">
                <FiSave /> Update Record
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}