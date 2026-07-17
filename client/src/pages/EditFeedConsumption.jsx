import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiInfo, FiFileText, FiSave, FiX } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditFeedConsumption.css";

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
function getQuantity(f) {
  if (!f) return null;
  const q = f.currentQuantity ?? f.currentBirds ?? f.quantity ?? f.headCount ?? f.quantityPurchased ?? f.numberOfBirds ?? f.birdCount;
  const n = Number(q);
  return isNaN(n) || n <= 0 ? null : n;
}
function computeConsumedKg(qty, plan) {
  if (!qty || !plan) return "";
  return String(Math.round((qty * plan.gPerHead / 1000) * 100) / 100);
}

export default function EditFeedConsumption() {
  const navigate = useNavigate();

  // Batch IDs come from FlockProfile (only show once flocks exist)
  const [batches, setBatches] = useState([]);
  const [saving, setSaving] = useState(false);
  const [flockList, setFlockList] = useState([]);
  const [autoMeta, setAutoMeta] = useState({});

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
        setFlockList(list);
        setBatches(ids);
      } catch {
        setFlockList([]);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const payload = { ...form, ...autoMeta };
    console.log("Feed consumption payload:", payload);
    // Backend: update the consumption record AND deduct payload.quantityConsumed
    // from Feed Inventory (Quantity Out) for the matching feedType.
    localStorage.removeItem("editFeedConsumption");
    if (window.__pbSaving) return;  // prevent duplicate submissions
    window.__pbSaving = true;
    try {
      setSaving(true);
      await fetch(`/api/feed-consumption/${form._id || form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setSaving(false); /* saving is local (mock API) — ignore network errors */ }
    finally { window.__pbSaving = false; }

    navigate("/inventory/feed-consumption");
  };

  return (
    <PageLayout background="#f4f4f2" breadcrumbItems={[{ label: "INVENTORY", path: "/inventory" }, { label: "FEED CONSUMPTION", path: "/inventory/feed-consumption" }, { label: "EDIT FEED CONSUMPTION" }]}>

        <form className="efc-form-card" onSubmit={handleSubmit}>

          {/* CONSUMPTION DETAILS */}
          <div className="efc-section-header">
            <FiInfo />
            <h3>CONSUMPTION DETAILS</h3>
            <div className="efc-line"></div>
          </div>

          <div className="efc-form-grid">
            <div className="efc-form-group">
              <label>Date <span className="efc-req">*</span></label>
              <input type="date" name="date" value={form.date} onChange={handleChange} required />
            </div>

            <div className="efc-form-group">
              <label>Batch ID <span className="efc-req">*</span></label>
              <select name="batchId" value={form.batchId} onChange={handleBatchChange} required>
                <option value="">{batches.length ? "Select batch" : "No batches available"}</option>
                {batches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="efc-form-group">
              <label>Feed Type <span className="efc-req">*</span></label>
              <select name="feedType" value={form.feedType} onChange={handleChange} required>
                <option value="">Select feed type</option>
                {FEED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="efc-form-group">
              <label>Quantity Consumed <span className="efc-req">*</span></label>
              <input
                type="number" min="0" name="quantityConsumed"
                value={form.quantityConsumed} onChange={handleChange}
                placeholder="Enter quantity consumed (kg)" required
              />
            </div>
          </div>

          {/* ADDITIONAL INFORMATION */}
          <div className="efc-section-header">
            <FiFileText />
            <h3>ADDITIONAL INFORMATION</h3>
            <div className="efc-line"></div>
          </div>

          <div className="efc-form-group efc-full-width">
            <label>Notes</label>
            <textarea
              rows="6" name="notes" value={form.notes} onChange={handleChange}
              placeholder="Enter notes about this consumption..." maxLength={255}
            />
            <small>{(form.notes || "").length} / 255</small>
          </div>

          {/* Actions */}
          <div className="efc-form-actions">
            <button type="button" className="efc-cancel-btn" onClick={() => navigate("/inventory/feed-consumption")}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="efc-save-btn">
              <FiSave />
              Update Record
            </button>
          </div>
        </form>

    </PageLayout>
  );
}