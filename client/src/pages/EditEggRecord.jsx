import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiInfo, FiGrid, FiBarChart2, FiSave, FiMenu,
} from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./EditEggRecord.css";

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

export default function EditEggRecord() {
  const navigate = useNavigate();
  const { id }   = useParams();

  const [formData, setFormData] = useState({
    batchId: "",
    collectionDate: "",
    peewee: "",
    small: "",
    medium: "",
    large: "",
    extraLarge: "",
    jumbo: "",
    crackedEggs: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  // Fetch existing record
  useEffect(() => {
    const fetchRecord = async () => {
      try {
        const res  = await fetch(`${API_BASE}/${id}`);
        const data = await res.json();
        const r = data.record || data.data;
        if (r) {
          setFormData({
            batchId:        r.batchId || "",
            collectionDate: r.collectionDate?.split("T")[0] || "",
            peewee:         r.peewee ?? "",
            small:          r.small ?? "",
            medium:         r.medium ?? "",
            large:          r.large ?? "",
            extraLarge:     r.extraLarge ?? "",
            jumbo:          r.jumbo ?? "",
            crackedEggs:    r.crackedEggs ?? "",
          });
        } else {
          setError(data.message || "Failed to load record.");
        }
      } catch {
        setError("Cannot connect to server. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id]);

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
      const res = await fetch(`${API_BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, goodEggs, totalEggs }),
      });
      const data = await res.json();
      if (data.success !== false) {
        setSuccess("Egg record updated successfully!");
        setTimeout(() => navigate("/records/egg"), 1200);
      } else {
        setError(data.message || "Failed to update record.");
      }
    } catch {
      setError("Cannot connect to server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="eer-page">
      <Sidebar />

      <div className="eer-main">

        {/* Breadcrumb */}
        <div className="eer-breadcrumb">
          <button className="eer-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="eer-breadcrumb-link" onClick={() => navigate("/records")}>
            RECORDS
          </span>
          <span>›</span>
          <span className="eer-breadcrumb-link" onClick={() => navigate("/records/egg")}>
            EGG RECORD
          </span>
          <span>›</span>
          <span className="eer-breadcrumb-current">EDIT EGG RECORD</span>
        </div>

        {/* Header */}
        <div className="eer-header">
          <div>
            <h2>Edit Egg Record</h2>
            <p>Update this egg collection. Good Eggs, Total Eggs, and Hen-Day % are computed automatically.</p>
          </div>
        </div>

        {/* Banners */}
        {success && <div className="eer-success-banner">{success}</div>}
        {error   && <div className="eer-error-banner">{error}</div>}

        {loading ? (
          <div className="eer-loading">Loading egg record...</div>
        ) : (
          <form className="eer-form-card" onSubmit={handleSubmit}>

            {/* BASIC INFORMATION */}
            <div className="eer-section-header">
              <FiInfo />
              <h3>BASIC INFORMATION</h3>
              <div className="eer-line" />
            </div>

            <div className="eer-form-grid">
              <div className="eer-form-group">
                <label>Batch ID <span className="req">*</span></label>
                <select name="batchId" value={formData.batchId} onChange={handleChange} required>
                  <option value="">Select Batch</option>
                  {formData.batchId && (
                    <option value={formData.batchId}>{formData.batchId}</option>
                  )}
                </select>
                <small>Select the flock batch for this collection.</small>
              </div>

              <div className="eer-form-group">
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
            <div className="eer-section-header">
              <FiGrid />
              <h3>EGG COUNTS</h3>
              <div className="eer-line" />
            </div>

            <div className="eer-count-grid">
              {COUNT_FIELDS.map((f) => (
                <div className="eer-form-group" key={f.name}>
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
            <div className="eer-section-header">
              <FiBarChart2 />
              <h3>COMPUTED RESULTS</h3>
              <div className="eer-line" />
            </div>

            <div className="eer-result-grid">
              <div className="eer-result-card">
                <h4>Good Eggs</h4>
                <div className="eer-result-value">{goodEggs}</div>
                <p>Total Eggs − Cracked Eggs</p>
              </div>

              <div className="eer-result-card">
                <h4>Total Eggs</h4>
                <div className="eer-result-value">{totalEggs}</div>
                <p>Sum of all egg counts</p>
              </div>

              <div className="eer-result-card">
                <h4>Hen-Day %</h4>
                <div className="eer-result-value green">0.00%</div>
                <p>( Total Eggs / Current Birds ) × 100</p>
              </div>
            </div>

            <div className="eer-info-box">
              <p>Good Eggs, Total Eggs, and Hen-Day % are automatically calculated based on your input.</p>
            </div>

            {/* Actions */}
            <div className="eer-form-actions">
              <button
                type="button"
                className="eer-cancel-btn"
                onClick={() => navigate("/records/egg")}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className="eer-save-btn" disabled={saving}>
                <FiSave />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  );
}