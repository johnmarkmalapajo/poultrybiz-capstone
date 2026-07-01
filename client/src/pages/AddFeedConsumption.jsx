import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiInfo, FiFileText, FiSave, FiMenu } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./AddFeedConsumption.css";

const BASE_URL = "https://poultrybiz.onrender.com/api/v1";
const FEED_TYPES = ["Grower Feed", "Layer Feed"];

// ── Feed transition rules by current age (weeks) ──
function getFeedPlan(week) {
  if (week == null || isNaN(week) || week < 17) return null;
  if (week === 17) return { grower: 100, layer: 0, gPerHead: 75 };
  if (week === 18) return { grower: 100, layer: 0, gPerHead: 85 };
  if (week === 19) return { grower: 75, layer: 25, gPerHead: 90 };
  if (week === 20) return { grower: 50, layer: 50, gPerHead: 95 };
  if (week === 21) return { grower: 25, layer: 75, gPerHead: 100 };
  if (week === 22) return { grower: 0, layer: 100, gPerHead: 105 };
  return { grower: 0, layer: 100, gPerHead: 110 }; // week 23 onwards
}
function planLabel(p) {
  if (!p) return "";
  const parts = [];
  if (p.grower) parts.push(`${p.grower}% Grower Feed`);
  if (p.layer) parts.push(`${p.layer}% Layer Feed`);
  return `${parts.join(" + ")} (${p.gPerHead} g/head/day)`;
}
function primaryFeed(p) {
  if (!p) return "";
  return p.layer > p.grower ? "Layer Feed" : "Grower Feed";
}
// Current age (weeks): use a numeric field if present, else derive from an acquisition/hatch date
function getAgeWeeks(f) {
  if (!f) return null;
  const direct = f.currentAgeWeeks ?? f.ageWeeks ?? f.currentAge ?? f.ageInWeeks ?? f.age;
  if (direct != null && direct !== "") return Math.floor(Number(direct));
  const start = f.dateAcquired || f.startDate || f.hatchDate || f.dateOfArrival || f.acquisitionDate;
  if (start) {
    const ms = Date.now() - new Date(start).getTime();
    if (!isNaN(ms)) return Math.max(0, Math.floor(ms / (7 * 24 * 60 * 60 * 1000)));
  }
  return null;
}
// Current quantity (head count) from a flock object
function getQuantity(f) {
  if (!f) return null;
  const q = f.currentQuantity ?? f.currentBirds ?? f.quantity ?? f.headCount ?? f.quantityPurchased ?? f.numberOfBirds ?? f.birdCount;
  const n = Number(q);
  return isNaN(n) || n <= 0 ? null : n;
}
// Quantity consumed (kg) = heads × g/head/day ÷ 1000
function computeConsumedKg(qty, plan) {
  if (!qty || !plan) return "";
  return String(Math.round((qty * plan.gPerHead / 1000) * 100) / 100);
}

export default function AddFeedConsumption() {
  const navigate = useNavigate();

  // Batch IDs come from FlockProfile (only show once flocks exist)
  const [batches, setBatches] = useState([]);
  const [flockList, setFlockList] = useState([]);
  const [autoMeta, setAutoMeta] = useState({});

  const [form, setForm] = useState({
    date: "", batchId: "", feedType: "", quantityConsumed: "", notes: "",
  });

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
        setFlockList(list);
        setBatches(ids);
      } catch {
        setFlockList([]);
        setBatches([]);
      }
    };
    fetchBatches();
  }, []);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // When a batch is selected: pull current age + quantity from the flock,
  // auto-determine the feed transition, and auto-compute Quantity Consumed.
  const handleBatchChange = (e) => {
    const batchId = e.target.value;
    const flock = flockList.find((f) => f.batchId === batchId);
    const age = getAgeWeeks(flock);
    const qty = getQuantity(flock);
    const plan = getFeedPlan(age);
    setAutoMeta({
      currentAge: age,
      currentQuantity: qty,
      feedTransition: planLabel(plan),
      gPerHeadPerDay: plan?.gPerHead ?? null,
    });
    setForm((f) => {
      const next = { ...f, batchId };
      if (plan && qty) {
        next.feedType = primaryFeed(plan);
        next.quantityConsumed = computeConsumedKg(qty, plan);
      }
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...form, ...autoMeta };
    console.log("Feed consumption payload:", payload);
    // Backend: create the consumption record AND deduct payload.quantityConsumed
    // from Feed Inventory (Quantity Out) for the matching feedType.
    navigate("/inventory/feed-consumption");
  };

  return (
    <div className="add-fc-page">
      <Sidebar />

      <div className="add-fc-main">

        {/* Breadcrumb */}
        <div className="add-fc-breadcrumb">
          <button className="add-fc-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="breadcrumb-link" onClick={() => navigate("/inventory")}>INVENTORY</span>
          <span>›</span>
          <span className="breadcrumb-link" onClick={() => navigate("/inventory/feed-consumption")}>FEED CONSUMPTION</span>
          <span>›</span>
          <span className="breadcrumb-current">ADD FEED CONSUMPTION</span>
        </div>

        {/* Header */}
        <div className="add-fc-header">
          <div>
            <h2>Add Feed Consumption</h2>
            <p>Record the daily feed consumption for a specific flock batch.</p>
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
              <label>Date <span className="req">*</span></label>
              <input type="date" name="date" value={form.date} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label>Batch ID <span className="req">*</span></label>
              <select name="batchId" value={form.batchId} onChange={handleBatchChange} required>
                <option value="">{batches.length ? "Select batch" : "No batches available"}</option>
                {batches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Feed Type <span className="req">*</span></label>
              <select name="feedType" value={form.feedType} onChange={handleChange} required>
                <option value="">Select feed type</option>
                {FEED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Quantity Consumed <span className="req">*</span></label>
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
            <small>{form.notes.length} / 255</small>
          </div>

          {/* Actions */}
          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={() => navigate("/inventory/feed-consumption")}>
              Cancel
            </button>
            <button type="submit" className="save-btn">
              <FiSave />
              Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}