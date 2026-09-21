import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiInfo, FiPackage, FiMapPin, FiFileText, FiSave } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { useUser } from "../hooks/useUser";
import "./AddEquipment.css";
import { createEquipment } from "../api/equipmentTools";
import { listPersonnel } from "../api/personnelManpower";

const CONDITIONS = ["In Use", "Idle", "For Repair", "For Disposal"];
const UNITS = ["pcs", "units", "sets", "pairs", "kg", "liters"];

const blockInvalidNumberKeys = (e) => {
  if (["-", "+", "e", "E"].includes(e.key)) {
    e.preventDefault();
  }
};

const blockInvalidNumberPaste = (e) => {
  const text = e.clipboardData.getData("text");
  if (!/^\d*\.?\d*$/.test(text)) {
    e.preventDefault();
  }
};

export default function AddEquipment() {
  const navigate = useNavigate();
  const { canSeeFinancials, role } = useUser();
  const isOwner = role === "Owner";

  const [custodians, setCustodians] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "", description: "", serialNo: "",
    quantity: "", unit: "", condition: "",
    location: "", custodian: "", dateAcquired: "",
    cost: "", remarks: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
  const fetchCustodians = async () => {
    try {
      const json = await listPersonnel();

      console.log("Personnel API:", json);

      const list =
        json.data ||
        json.personnel ||
        json.records ||
        (Array.isArray(json) ? json : []);

      console.log("Personnel List:", list);

      const names = [
        ...new Set(
          list
            .map(
              (p) =>
                p.user?.name ||
                p.user?.fullName ||
                p.name ||
                p.fullName
            )
            .filter(Boolean)
        ),
      ];

      console.log("Custodians:", names);

      setCustodians(names);
    } catch (err) {
      console.error("Fetch Custodians Error:", err);
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
    if (window.__pbSaving) return;
    window.__pbSaving = true;
    setSaving(true); setError("");
    try {
      if (
        !form.quantity ||
        Number.isNaN(Number(form.quantity)) ||
        Number(form.quantity) <= 0
      ) {
        throw new Error("Please enter a valid quantity.");
      }

      if (
        form.cost !== "" &&
        (Number.isNaN(Number(form.cost)) || Number(form.cost) < 0)
      ) {
        throw new Error("Please enter a valid acquisition cost.");
      }

      await createEquipment(form);
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { }
      navigate("/inventory/equipment");
    } catch (err) {
      setError(err?.message || "Couldn't save this record. Please try again.");
      setSaving(false);
    } finally {
      window.__pbSaving = false;
    }
  };

  return (
    <PageLayout background="#f4f4f2" breadcrumbItems={[{ label: "INVENTORY", path: "/inventory" }, { label: "EQUIPMENT & TOOLS", path: "/inventory/equipment" }, { label: "ADD EQUIPMENT" }]}>

        <form className="aeq-form-card" onSubmit={handleSubmit}>

          {error && (
            <div className="pb-error-banner">
              {error}
            </div>
          )}

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

          <div className="aeq-section-header">
            <FiPackage />
            <h3>STOCK &amp; CONDITION</h3>
            <div className="aeq-line"></div>
          </div>

          <div className="aeq-form-grid">
            <div className="aeq-form-group">
              <label>Quantity <span className="aeq-req">*</span></label>
              <input type="number" min="0" name="quantity" value={form.quantity} onChange={handleChange} onKeyDown={blockInvalidNumberKeys} onPaste={blockInvalidNumberPaste} placeholder="Enter quantity" required />
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
              <label>Custodian/Assigned To {isOwner && <span className="aeq-req">*</span>}</label>
              {isOwner ? (
                <>
                  <input
                    type="text"
                    name="custodian"
                    list="aeq-custodian-list"
                    value={form.custodian}
                    onChange={handleChange}
                    placeholder="Type or pick a custodian name"
                    required
                  />
                  <datalist id="aeq-custodian-list">
                    {custodians.map((c) => <option key={c} value={c} />)}
                  </datalist>
                  {!custodians.length && (
                    <small>No personnel records yet — you can still type a name.</small>
                  )}
                </>
              ) : (
                <input type="text" value={form.custodian || "—"} disabled readOnly />
              )}
              {!isOwner && <small>Only the Owner can assign a custodian.</small>}
            </div>

            {isOwner && (
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
                  <input type="number" min="0" step="0.01" name="cost" value={form.cost} onChange={handleChange} onKeyDown={blockInvalidNumberKeys} onPaste={blockInvalidNumberPaste} placeholder="0.00" required />
                </div>
              </div>
            )}
          </div>

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