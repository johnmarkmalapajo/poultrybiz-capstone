import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiInfo, FiGrid, FiBarChart2, FiSave, FiMenu,
} from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./AddEggRecord.css";

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/egg-records`;

const COUNT_FIELDS = [
  { name: "peewee",      label: "Peewee" },
  { name: "small",       label: "Small" },
  { name: "medium",      label: "Medium" },
  { name: "large",       label: "Large" },
  { name: "extraLarge",  label: "Extra Large" },
  { name: "jumbo",       label: "Jumbo" },
  { name: "crackedEggs", label: "Cracked Eggs" },
];

export default function AddEggRecord() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    batchId: "",
    collectionDate: new Date().toISOString().split("T")[0],
    peewee: "",
    small: "",
    medium: "",
    large: "",
    extraLarge: "",
    jumbo: "",
    crackedEggs: "",
  });

  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  const num = (v) => parseInt(v, 10) || 0;

  const totalEggs =
    num(formData.peewee) + num(formData.small) + num(formData.medium) +
    num(formData.large) + num(formData.extraLarge) + num(formData.jumbo) +
    num(formData.crackedEggs);

  const goodEggs = totalEggs - num(formData.crackedEggs);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, goodEggs, totalEggs }),
      });
      const data = await res.json();
      if (data.success !== false) {
        setSuccess("Egg record saved successfully!");
        setTimeout(() => navigate("/records/egg"), 1200);
      } else {
        setError(data.message || "Failed to save record.");
      }
    } catch {
      setError("Cannot connect to server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="aer-page">
      <Sidebar />

      <div className="aer-main">

        {/* Breadcrumb */}
        <div className="aer-breadcrumb">
          <button className="aer-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="aer-breadcrumb-link" onClick={() => navigate("/records")}>
            RECORDS
          </span>
          <span>›</span>
          <span className="aer-breadcrumb-link" onClick={() => navigate("/records/egg")}>
            EGG RECORD
          </span>
          <span>›</span>
          <span className="aer-breadcrumb-current">ADD EGG RECORD</span>
        </div>

        {/* Header */}
        <div className="aer-header">
          <div>
            <h2>Add Egg Record</h2>
            <p>Log a daily egg collection. Good Eggs, Total Eggs, and Hen-Day % are computed automatically.</p>
          </div>
        </div>

        {/* Banners */}
        {success && <div className="aer-success-banner">{success}</div>}
        {error   && <div className="aer-error-banner">{error}</div>}

        <form className="aer-form-card" onSubmit={handleSubmit}>

          {/* BASIC INFORMATION */}
          <div className="aer-section-header">
            <FiInfo />
            <h3>BASIC INFORMATION</h3>
            <div className="aer-line" />
          </div>

          <div className="aer-form-grid">
            <div className="aer-form-group">
              <label>Batch ID <span className="req">*</span></label>
              <select name="batchId" value={formData.batchId} onChange={handleChange} required>
                <option value="">Select Batch</option>
              </select>
              <small>Select the flock batch for this collection.</small>
            </div>

            <div className="aer-form-group">
              <label>Date <span className="req">*</span></label>
              <input
                type="date"
                name="collectionDate"
                value={formData.collectionDate}
                onChange={handleChange}
                required
              />
              <small>Date the eggs were collected.</small>
            </div>
          </div>

          {/* EGG COUNTS */}
          <div className="aer-section-header">
            <FiGrid />
            <h3>EGG COUNTS</h3>
            <div className="aer-line" />
          </div>

          <div className="aer-count-grid">
            {COUNT_FIELDS.map((f) => (
              <div className="aer-form-group" key={f.name}>
                <label>{f.label}</label>
                <input
                  type="number"
                  min="0"
                  name={f.name}
                  value={formData[f.name]}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
            ))}
          </div>

          {/* COMPUTED RESULTS */}
          <div className="aer-section-header">
            <FiBarChart2 />
            <h3>COMPUTED RESULTS</h3>
            <div className="aer-line" />
          </div>

          <div className="aer-result-grid">
            <div className="aer-result-card">
              <h4>Good Eggs</h4>
              <div className="aer-result-value">{goodEggs}</div>
              <p>Total Eggs − Cracked Eggs</p>
            </div>

            <div className="aer-result-card">
              <h4>Total Eggs</h4>
              <div className="aer-result-value">{totalEggs}</div>
              <p>Sum of all egg counts</p>
            </div>

            <div className="aer-result-card">
              <h4>Hen-Day %</h4>
              <div className="aer-result-value green">0.00%</div>
              <p>( Total Eggs / Current Birds ) × 100</p>
            </div>
          </div>

          <div className="aer-info-box">
            <p>Good Eggs, Total Eggs, and Hen-Day % are automatically calculated based on your input.</p>
          </div>

          {/* Actions */}
          <div className="aer-form-actions">
            <button
              type="button"
              className="aer-cancel-btn"
              onClick={() => navigate("/records/egg")}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="aer-save-btn" disabled={saving}>
              <FiSave />
              {saving ? "Saving..." : "Save Egg Record"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}