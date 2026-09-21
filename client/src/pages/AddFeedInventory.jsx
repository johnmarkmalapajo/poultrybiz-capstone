import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiInfo, FiActivity, FiFileText, FiSave } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./AddFeedInventory.css";
import { createFeedInventory } from "../api/feedInventory";
import { listFeedConsumption } from "../api/feedConsumption";

const FEED_TYPES = ["Grower Feed", "Layer Feed"];

export default function AddFeedInventory() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    date: "", feedType: "", quantityIn: "", quantityOut: "", notes: "",
  });

  // Total consumed per feed type — drives Quantity Out automatically
  const [consumedByType, setConsumedByType] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchConsumption = async () => {
      try {
        const json = await listFeedConsumption();
        const list = json.data || json.records || (Array.isArray(json) ? json : []);
        const map = {};
        list.forEach((c) => {
          const t = c.feedType;
          if (!t) return;
          map[t] = (map[t] || 0) + (Number(c.quantityConsumed) || 0);
        });
        setConsumedByType(map);
      } catch {
        setConsumedByType({});
      }
    };
    fetchConsumption();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => {
      // Quantity Out auto-fills from Feed Consumption totals for the chosen feed type
      if (name === "feedType") {
        const out = consumedByType[value] != null ? String(consumedByType[value]) : "0";
        return { ...f, feedType: value, quantityOut: out };
      }
      return { ...f, [name]: value };
    });
  };

  const balance = (parseFloat(form.quantityIn) || 0) - (parseFloat(form.quantityOut) || 0);
  const [saving, setSaving] = useState(false);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const payload = { ...form, balance };
    if (window.__pbSaving) return;  // prevent duplicate submissions
    window.__pbSaving = true;
    setSaving(true); setError("");
    try {
      await createFeedInventory(payload);
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { /* ignore */ }
      navigate("/inventory/feed-inventory");
    } catch (err) {
      setError(err?.message || "Couldn't save this record. Please try again.");
      setSaving(false);
    } finally {
      window.__pbSaving = false;
    }
  };

  return (
    <PageLayout background="#f4f4f2" breadcrumbItems={[{ label: "INVENTORY", path: "/inventory" }, { label: "FEED INVENTORY", path: "/inventory/feed-inventory" }, { label: "ADD FEED INVENTORY" }]}>

        <form className="afi-form-card" onSubmit={handleSubmit}>

          {error && (
            <div className="pb-error-banner">
              {error}
            </div>
          )}

          {/* FEED DETAILS */}
          <div className="afi-section-header">
            <FiInfo />
            <h3>FEED DETAILS</h3>
            <div className="afi-line"></div>
          </div>

          <div className="afi-form-grid">
            <div className="afi-form-group">
              <label>Date Purchased <span className="afi-req">*</span></label>
              <input type="date" name="date" value={form.date} onChange={handleChange} required />
            </div>

            <div className="afi-form-group">
              <label>Feed Type <span className="afi-req">*</span></label>
              <select name="feedType" value={form.feedType} onChange={handleChange} required>
                <option value="">Select feed type</option>
                {FEED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="afi-form-group">
              <label>Quantity In <span className="afi-req">*</span></label>
              <input
                type="number" min="0" name="quantityIn"
                value={form.quantityIn} onChange={handleChange}
                placeholder="Enter quantity in (kg)" required
              />
            </div>

            <div className="afi-form-group">
              <label>Quantity Out <span className="afi-req">*</span></label>
              <input
                type="number" min="0" name="quantityOut"
                value={form.quantityOut} readOnly
                placeholder="Auto from Feed Consumption"
              />
              <small>Auto-updated from Feed Consumption records.</small>
            </div>
          </div>

          {/* AUTO-COMPUTED */}
          <div className="afi-section-header">
            <FiActivity />
            <h3>AUTO-COMPUTED</h3>
            <div className="afi-line"></div>
          </div>

          <div className="afi-form-grid">
            <div className="afi-form-group">
              <label>Balance</label>
              <input type="text" value={`${balance} kg`} disabled />
              <small>Balance = Quantity In − Quantity Out</small>
            </div>
          </div>

          {/* ADDITIONAL INFORMATION */}
          <div className="afi-section-header">
            <FiFileText />
            <h3>ADDITIONAL INFORMATION</h3>
            <div className="afi-line"></div>
          </div>

          <div className="afi-form-group afi-full-width">
            <label>Notes</label>
            <textarea
              rows="6" name="notes" value={form.notes} onChange={handleChange}
              placeholder="Enter notes for this transaction..." maxLength={255}
            />
            <small>{form.notes.length} / 255</small>
          </div>

          {/* Actions */}
          <div className="afi-form-actions">
            <button type="button" className="afi-cancel-btn" onClick={() => navigate("/inventory/feed-inventory")}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="afi-save-btn">
              <FiSave />
              Save Feed Record
            </button>
          </div>
        </form>

    </PageLayout>
  );
}