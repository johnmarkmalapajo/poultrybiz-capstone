import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiInfo, FiActivity, FiFileText, FiSave, FiMenu } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./AddFeedInventory.css";

const FEED_TYPES = ["Starter Feed", "Grower Feed", "Layer Feed", "Finisher Feed"];

export default function AddFeedInventory() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    date: "", feedType: "", quantityIn: "", quantityOut: "", notes: "",
  });

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const balance = (parseFloat(form.quantityIn) || 0) - (parseFloat(form.quantityOut) || 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    // API integration later
    navigate("/inventory/feed-inventory");
  };

  return (
    <div className="add-feed-page">
      <Sidebar />

      <div className="add-feed-main">

        {/* Breadcrumb */}
        <div className="add-feed-breadcrumb">
          <button className="add-feed-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="breadcrumb-link" onClick={() => navigate("/inventory")}>INVENTORY</span>
          <span>›</span>
          <span className="breadcrumb-link" onClick={() => navigate("/inventory/feed-inventory")}>FEED STOCK</span>
          <span>›</span>
          <span className="breadcrumb-current">ADD FEED</span>
        </div>

        {/* Header */}
        <div className="add-feed-header">
          <div>
            <h2>Add Feed Stock</h2>
            <p>Record incoming and outgoing feed stock. The balance is computed automatically from Quantity In and Quantity Out.</p>
          </div>
        </div>

        <form className="feed-form-card" onSubmit={handleSubmit}>

          {/* FEED DETAILS */}
          <div className="section-header">
            <FiInfo />
            <h3>FEED DETAILS</h3>
            <div className="line"></div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Date *</label>
              <input type="date" name="date" value={form.date} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label>Feed Type *</label>
              <select name="feedType" value={form.feedType} onChange={handleChange} required>
                <option value="">Select feed type</option>
                {FEED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Quantity In *</label>
              <input
                type="number" min="0" name="quantityIn"
                value={form.quantityIn} onChange={handleChange}
                placeholder="Enter quantity in (kg)" required
              />
            </div>

            <div className="form-group">
              <label>Quantity Out *</label>
              <input
                type="number" min="0" name="quantityOut"
                value={form.quantityOut} onChange={handleChange}
                placeholder="Enter quantity out (kg)" required
              />
            </div>
          </div>

          {/* AUTO-COMPUTED */}
          <div className="section-header">
            <FiActivity />
            <h3>AUTO-COMPUTED</h3>
            <div className="line"></div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Balance</label>
              <input type="text" value={`${balance} kg`} disabled />
              <small>Balance = Quantity In − Quantity Out</small>
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
              placeholder="Enter notes for this transaction..." maxLength={255}
            />
            <small>{form.notes.length} / 255</small>
          </div>

          {/* Actions */}
          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={() => navigate("/inventory/feed-inventory")}>
              Cancel
            </button>
            <button type="submit" className="save-btn">
              <FiSave />
              Save Feed Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}