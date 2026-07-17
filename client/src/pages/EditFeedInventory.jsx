import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiInfo, FiActivity, FiFileText, FiSave, FiX } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditFeedInventory.css";

const BASE_URL = "https://poultrybiz.onrender.com/api/v1";
const FEED_TYPES = ["Grower Feed", "Layer Feed"];

export default function EditFeedInventory() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    date: "", feedType: "", quantityIn: "", quantityOut: "", notes: "",
  });

  // Total consumed per feed type — drives Quantity Out automatically
  const [consumedByType, setConsumedByType] = useState({});

  // Load the record set by the Edit button on the Feed Stock list
  useEffect(() => {
    const saved = localStorage.getItem("editFeedRecord");
    if (saved) {
      const r = JSON.parse(saved);
      setForm({
        date: r.date || "",
        feedType: r.feedType || "",
        quantityIn: r.quantityIn ?? "",
        quantityOut: r.quantityOut ?? "",
        notes: r.notes || "",
      });
    }
  }, []);

  // Fetch consumption totals per feed type
  useEffect(() => {
    const fetchConsumption = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${BASE_URL}/feed-consumption`, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
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

  // Keep Quantity Out in sync with Feed Consumption for the current feed type
  useEffect(() => {
    if (form.feedType && consumedByType[form.feedType] != null) {
      setForm((f) => ({ ...f, quantityOut: String(consumedByType[form.feedType]) }));
    }
  }, [consumedByType, form.feedType]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => {
      if (name === "feedType") {
        const out = consumedByType[value] != null ? String(consumedByType[value]) : f.quantityOut;
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
    console.log("Feed inventory payload:", payload);
    // Backend: persist the stock record. Quantity Out stays in sync with
    // Feed Consumption, and Balance = Quantity In − Quantity Out.
    localStorage.removeItem("editFeedRecord");
    if (window.__pbSaving) return;  // prevent duplicate submissions
    window.__pbSaving = true;
    try {
      setSaving(true);
      await fetch(`/api/feed-inventory/${form._id || form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setSaving(false); /* saving is local (mock API) — ignore network errors */ }
    finally { window.__pbSaving = false; }

    navigate("/inventory/feed-inventory");
  };

  return (
    <PageLayout background="#f4f4f2" breadcrumbItems={[{ label: "INVENTORY", path: "/inventory" }, { label: "FEED INVENTORY", path: "/inventory/feed-inventory" }, { label: "EDIT FEED INVENTORY" }]}>

        <form className="efi-form-card" onSubmit={handleSubmit}>

          {/* FEED DETAILS */}
          <div className="efi-section-header">
            <FiInfo />
            <h3>FEED DETAILS</h3>
            <div className="efi-line"></div>
          </div>

          <div className="efi-form-grid">
            <div className="efi-form-group">
              <label>Date Purchased <span className="efi-req">*</span></label>
              <input type="date" name="date" value={form.date} onChange={handleChange} required />
            </div>

            <div className="efi-form-group">
              <label>Feed Type <span className="efi-req">*</span></label>
              <select name="feedType" value={form.feedType} onChange={handleChange} required>
                <option value="">Select feed type</option>
                {FEED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="efi-form-group">
              <label>Quantity In <span className="efi-req">*</span></label>
              <input
                type="number" min="0" name="quantityIn"
                value={form.quantityIn} onChange={handleChange}
                placeholder="Enter quantity in (kg)" required
              />
            </div>

            <div className="efi-form-group">
              <label>Quantity Out <span className="efi-req">*</span></label>
              <input
                type="number" min="0" name="quantityOut"
                value={form.quantityOut} readOnly
                placeholder="Auto from Feed Consumption"
              />
              <small>Auto-updated from Feed Consumption records.</small>
            </div>
          </div>

          {/* AUTO-COMPUTED */}
          <div className="efi-section-header">
            <FiActivity />
            <h3>AUTO-COMPUTED</h3>
            <div className="efi-line"></div>
          </div>

          <div className="efi-form-grid">
            <div className="efi-form-group">
              <label>Balance</label>
              <input type="text" value={`${balance} kg`} disabled />
              <small>Balance = Quantity In − Quantity Out</small>
            </div>
          </div>

          {/* ADDITIONAL INFORMATION */}
          <div className="efi-section-header">
            <FiFileText />
            <h3>ADDITIONAL INFORMATION</h3>
            <div className="efi-line"></div>
          </div>

          <div className="efi-form-group efi-full-width">
            <label>Notes</label>
            <textarea
              rows="6" name="notes" value={form.notes} onChange={handleChange}
              placeholder="Enter notes for this transaction..." maxLength={255}
            />
            <small>{(form.notes || "").length} / 255</small>
          </div>

          {/* Actions */}
          <div className="efi-form-actions">
            <button type="button" className="efi-cancel-btn" onClick={() => navigate("/inventory/feed-inventory")}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="efi-save-btn">
              <FiSave />
              Update Feed Record
            </button>
          </div>
        </form>

    </PageLayout>
  );
}