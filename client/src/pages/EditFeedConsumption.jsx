import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiInfo, FiFileText, FiSave, FiMenu } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./EditFeedConsumption.css";

const BASE_URL = "https://poultrybiz.onrender.com/api/v1";
const FEED_TYPES = ["Starter Feed", "Grower Feed", "Layer Feed", "Finisher Feed"];

export default function EditFeedConsumption() {
  const navigate = useNavigate();

  // Batch IDs come from FlockProfile (only show once flocks exist)
  const [batches, setBatches] = useState([]);

  const [form, setForm] = useState({
    date: "", batchId: "", feedType: "", quantityConsumed: "", notes: "",
  });

  // Fetch batch IDs from flocks
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${BASE_URL}/flocks`, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const list = json.data || json.flocks || json.records || (Array.isArray(json) ? json : []);
        const ids = [...new Set(list.map((f) => f.batchId).filter(Boolean))];
        setBatches(ids);
      } catch {
        setBatches([]);
      }
    };
    fetchBatches();
  }, []);

  // Load record set by the Edit button on the Feed Consumption list
  useEffect(() => {
    const saved = localStorage.getItem("editFeedConsumption");
    if (saved) {
      const r = JSON.parse(saved);
      setForm({
        date: r.date || "",
        batchId: r.batchId || "",
        feedType: r.feedType || "",
        quantityConsumed: r.quantityConsumed ?? "",
        notes: r.notes || "",
      });
    }
  }, []);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    localStorage.removeItem("editFeedConsumption");
    navigate("/inventory/feed-consumption");
  };

  return (
    <div className="edit-fc-page">
      <Sidebar />

      <div className="edit-fc-main">

        {/* Breadcrumb */}
        <div className="edit-fc-breadcrumb">
          <button className="edit-fc-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="breadcrumb-link" onClick={() => navigate("/inventory")}>INVENTORY</span>
          <span>›</span>
          <span className="breadcrumb-link" onClick={() => navigate("/inventory/feed-consumption")}>FEED CONSUMPTION</span>
          <span>›</span>
          <span className="breadcrumb-current">EDIT CONSUMPTION</span>
        </div>

        {/* Header */}
        <div className="edit-fc-header">
          <div>
            <h2>Edit Feed Consumption</h2>
            <p>Update the details of this feed consumption record.</p>
          </div>
        </div>

        <form className="fc-form-card" onSubmit={handleSubmit}>

          {/* CONSUMPTION DETAILS */}
          <div className="section-header">
            <FiInfo />
            <h3>CONSUMPTION DETAILS</h3>
            <div className="line"></div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Date *</label>
              <input type="date" name="date" value={form.date} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label>Batch ID *</label>
              <select name="batchId" value={form.batchId} onChange={handleChange} required>
                <option value="">{batches.length ? "Select batch" : "No batches available"}</option>
                {batches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Feed Type *</label>
              <select name="feedType" value={form.feedType} onChange={handleChange} required>
                <option value="">Select feed type</option>
                {FEED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Quantity Consumed *</label>
              <input
                type="number" min="0" name="quantityConsumed"
                value={form.quantityConsumed} onChange={handleChange}
                placeholder="Enter quantity consumed (kg)" required
              />
            </div>
          </div>

          {/* ADDITIONAL INFORMATION */}
          <div className="section-header">
            <FiFileText />
            <h3>ADDITIONAL INFORMATION</h3>
            <div className="line"></div>
          </div>

          <div className="form-group full-width">
            <label>Notes</label>
            <textarea
              rows="6" name="notes" value={form.notes} onChange={handleChange}
              placeholder="Enter notes about this consumption..." maxLength={255}
            />
            <small>{(form.notes || "").length} / 255</small>
          </div>

          {/* Actions */}
          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={() => navigate("/inventory/feed-consumption")}>
              Cancel
            </button>
            <button type="submit" className="save-btn">
              <FiSave />
              Update Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}