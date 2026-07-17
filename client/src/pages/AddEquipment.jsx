import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiInfo, FiPackage, FiMapPin, FiFileText, FiSave, FiX } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { useUser } from "../hooks/useUser";
import "./AddEquipment.css";

const BASE_URL = "https://poultrybiz.onrender.com/api/v1";
const CONDITIONS = ["Good", "Fair", "Poor"];
const UNITS = ["pcs", "units", "sets", "pairs", "kg", "liters"];

export default function AddEquipment() {
  const navigate = useNavigate();
  const { canSeeFinancials, role } = useUser();
  const isAdmin = role === "Admin";

  // Custodians come from Personnel (only show once personnel exist)
  const [custodians, setCustodians] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "", description: "", serialNo: "",
    quantity: "", unit: "", condition: "",
    location: "", custodian: "", dateAcquired: "",
    cost: "", remarks: "",
  });

  useEffect(() => {
    const fetchCustodians = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${BASE_URL}/personnel`, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        const list = json.data || json.personnel || json.records || (Array.isArray(json) ? json : []);
        const names = [...new Set(list.map((p) => p.name || p.fullName).filter(Boolean))];
        setCustodians(names);
      } catch {
        setCustodians([]);
      }
    };
    fetchCustodians();
  }, []);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (window.__pbSaving) return;  // prevent duplicate submissions
    window.__pbSaving = true;
    try {
      setSaving(true);
      await fetch(`/api/equipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } catch {
      setSaving(false); /* saving is local (mock API) — ignore network errors */ }
    finally { window.__pbSaving = false; }

    navigate("/inventory/equipment");
  };

  return (
    <PageLayout background="#f4f4f2" breadcrumbItems={[{ label: "INVENTORY", path: "/inventory" }, { label: "EQUIPMENT & TOOLS", path: "/inventory/equipment" }, { label: "ADD EQUIPMENT" }]}>

        <form className="aeq-form-card" onSubmit={handleSubmit}>

          {/* EQUIPMENT DETAILS */}
          <div className="aeq-section-header">
            <FiInfo />
            <h3>EQUIPMENT DETAILS</h3>
            <div className="aeq-line"></div>
          </div>

          <div className="aeq-form-grid">
            <div className="aeq-form-group">
              <label>Item No.</label>
              <input type="text" value="(Auto-generated)" disabled />
            </div>

            <div className="aeq-form-group">
              <label>Equipment/Tool Name <span className="aeq-req">*</span></label>
              <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="Enter equipment/tool name" required />
            </div>

            <div className="aeq-form-group">
              <label>Serial/ID No.</label>
              <input type="text" name="serialNo" value={form.serialNo} onChange={handleChange} placeholder="Enter serial or ID number" />
            </div>

            <div className="aeq-form-group aeq-full-width">
              <label>Description/Specifications <span className="aeq-req">*</span></label>
              <textarea name="description" value={form.description} onChange={handleChange} rows="3" placeholder="Enter description or specifications" required />
            </div>
          </div>

          {/* STOCK & CONDITION */}
          <div className="aeq-section-header">
            <FiPackage />
            <h3>STOCK &amp; CONDITION</h3>
            <div className="aeq-line"></div>
          </div>

          <div className="aeq-form-grid">
            <div className="aeq-form-group">
              <label>Quantity <span className="aeq-req">*</span></label>
              <input type="number" min="0" name="quantity" value={form.quantity} onChange={handleChange} placeholder="Enter quantity" required />
            </div>

            <div className="aeq-form-group">
              <label>Unit <span className="aeq-req">*</span></label>
              <select name="unit" value={form.unit} onChange={handleChange} required>
                <option value="">Select unit</option>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div className="aeq-form-group">
              <label>Condition <span className="aeq-req">*</span></label>
              <select name="condition" value={form.condition} onChange={handleChange} required>
                <option value="">Select condition</option>
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* ASSIGNMENT & ACQUISITION */}
          <div className="aeq-section-header">
            <FiMapPin />
            <h3>ASSIGNMENT &amp; ACQUISITION</h3>
            <div className="aeq-line"></div>
          </div>

          <div className="aeq-form-grid">
            <div className="aeq-form-group">
              <label>Location/Storage <span className="aeq-req">*</span></label>
              <input type="text" name="location" value={form.location} onChange={handleChange} placeholder="Enter location or storage area" required />
            </div>

            <div className="aeq-form-group">
              <label>Custodian/Assigned To {isAdmin && <span className="aeq-req">*</span>}</label>
              {isAdmin ? (
                <select name="custodian" value={form.custodian} onChange={handleChange} required>
                  <option value="">{custodians.length ? "Select custodian" : "No personnel available"}</option>
                  {custodians.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input type="text" value={form.custodian || "—"} disabled readOnly />
              )}
              {!isAdmin && <small>Only Admin can assign a custodian.</small>}
            </div>

            {isAdmin && (
              <div className="aeq-form-group">
                <label>Date Acquired <span className="aeq-req">*</span></label>
                <input type="date" name="dateAcquired" value={form.dateAcquired} onChange={handleChange} required />
              </div>
            )}

            {canSeeFinancials && (
              <div className="aeq-form-group">
                <label>Acquisition Cost <span className="aeq-req">*</span></label>
                <div className="aeq-input-with-prefix">
                  <span className="aeq-prefix">₱</span>
                  <input type="number" min="0" step="0.01" name="cost" value={form.cost} onChange={handleChange} placeholder="0.00" required />
                </div>
              </div>
            )}
          </div>

          {/* ADDITIONAL */}
          <div className="aeq-section-header">
            <FiFileText />
            <h3>ADDITIONAL</h3>
            <div className="aeq-line"></div>
          </div>

          <div className="aeq-form-group aeq-full-width">
            <label>Remarks</label>
            <textarea name="remarks" value={form.remarks} onChange={handleChange} rows="4" placeholder="Enter remarks (optional)" maxLength={255} />
            <small>{form.remarks.length} / 255</small>
          </div>

          {/* Actions */}
          <div className="aeq-form-actions">
            <button type="button" className="aeq-cancel-btn" onClick={() => navigate("/inventory/equipment")}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="aeq-save-btn">
              <FiSave />
              Save Record
            </button>
          </div>
        </form>

    </PageLayout>
  );
}