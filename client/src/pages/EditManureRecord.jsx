import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiSave, FiX, FiMenu, FiPackage, FiFileText } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./EditManureRecord.css";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1");

export default function EditManureRecord() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    date: "",
    batchId: "",
    quantityCollected: "",
    methodOfHandling: "",
    storageLocation: "",
    endUse: "",
    personResponsible: "",
    remarks: "",
  });

  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/manure-records/${id}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await res.json();
        const rec = json.record || json.data || json;
        setFormData((prev) => ({ ...prev, ...rec }));
      } catch {
        /* keep empty form if fetch fails */
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
      await fetch(`${API}/manure-records/${id}`, {
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
    navigate("/records/manure");
  };

  if (loading) {
    return (
      <div className="emn-page">
        <Sidebar />
        <div className="emn-main">
          <p style={{ color: "#aaa", fontFamily: "var(--font-body)" }}>Loading record...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="emn-page">
      <Sidebar />

      <div className="emn-main">

        {/* Breadcrumb */}
        <div className="emn-breadcrumb">
          <button className="emn-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="emn-bc-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span className="emn-bc-sep">›</span>
          <span className="emn-bc-link" onClick={() => navigate("/records/manure")}>MANURE AND WASTE RECORD</span>
          <span className="emn-bc-sep">›</span>
          <span className="emn-bc-current">EDIT MANURE</span>
        </div>

        {/* Header */}
        <div className="emn-header">
          <div>
            <h2>Edit Manure Record</h2>
            <p>Update the details of this manure collection record.</p>
          </div>
        </div>

        <form className="emn-form-card" onSubmit={handleSubmit}>

          {/* MANURE DETAILS */}
          <div className="emn-section-header">
            <FiPackage />
            <h3>Manure Details</h3>
            <div className="emn-line" />
          </div>

          <div className="emn-form-grid">
            <div className="emn-form-group">
              <label>Date <span className="emn-req">*</span></label>
              <input type="date" name="date"
                value={formData.date ? String(formData.date).slice(0, 10) : ""}
                onChange={handleChange} required />
            </div>

            <div className="emn-form-group">
              <label>Batch ID / House No. <span className="emn-req">*</span></label>
              <select name="batchId" value={formData.batchId} onChange={handleChange} required>
                <option value="">Select batch / house</option>
                {formData.batchId && <option value={formData.batchId}>{formData.batchId}</option>}
              </select>
            </div>

            <div className="emn-form-group">
              <label>Quantity of Manure Collected <span className="emn-req">*</span></label>
              <div className="emn-input-unit">
                <input type="number" min="0" name="quantityCollected" value={formData.quantityCollected}
                  onChange={handleChange} placeholder="Enter quantity" required />
                <span className="emn-unit">kg</span>
              </div>
            </div>

            <div className="emn-form-group">
              <label>Method of Handling <span className="emn-req">*</span></label>
              <select name="methodOfHandling" value={formData.methodOfHandling} onChange={handleChange} required>
                <option value="">Select method</option>
                <option value="Composting">Composting</option>
                <option value="Drying">Drying</option>
                <option value="Biogas">Biogas</option>
                <option value="Direct Application">Direct Application</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="emn-form-group">
              <label>Storage Location <span className="emn-req">*</span></label>
              <input type="text" name="storageLocation" value={formData.storageLocation}
                onChange={handleChange} placeholder="Enter storage location" required />
            </div>

            <div className="emn-form-group">
              <label>End Use / Disposal <span className="emn-req">*</span></label>
              <select name="endUse" value={formData.endUse} onChange={handleChange} required>
                <option value="">Select end use / disposal</option>
                <option value="Used as fertilizer">Used as fertilizer</option>
                <option value="Sold">Sold</option>
                <option value="Composted">Composted</option>
                <option value="Biogas">Biogas</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="emn-form-group">
              <label>Person Responsible <span className="emn-req">*</span></label>
              <select name="personResponsible" value={formData.personResponsible} onChange={handleChange} required>
                <option value="">Select person</option>
                {formData.personResponsible && (
                  <option value={formData.personResponsible}>{formData.personResponsible}</option>
                )}
              </select>
            </div>
          </div>

          {/* ADDITIONAL INFORMATION */}
          <div className="emn-section-header">
            <FiFileText />
            <h3>Additional Information</h3>
            <div className="emn-line" />
          </div>

          <div className="emn-form-group emn-full-width">
            <label>Remarks</label>
            <textarea name="remarks" value={formData.remarks || ""} onChange={handleChange}
              placeholder="Enter any remarks (optional)..." maxLength={255} />
            <small className="emn-char-count">{(formData.remarks || "").length} / 255</small>
          </div>

          {/* Actions */}
          <div className="emn-form-actions">
            <p className="emn-req-note">Fields with * are required.</p>
            <div className="emn-action-btns">
              <button type="button" className="emn-cancel-btn" onClick={() => navigate("/records/manure")}>
                <FiX /> Cancel
              </button>
              <button type="submit" className="emn-save-btn">
                <FiSave /> Update Record
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}