import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiInfo, FiPackage, FiMapPin, FiFileText, FiSave } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { useUser } from "../hooks/useUser";
import "./EditEquipment.css";
import { getEquipment, updateEquipment } from "../api/equipmentTools";
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

export default function EditEquipment() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { canSeeFinancials, role } = useUser();
  const isOwner = role === "Owner";

  const [custodians, setCustodians] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expenseRecordId, setExpenseRecordId] = useState(null);
  const [form, setForm] = useState({
    name: "", description: "", serialNo: "",
    quantity: "", unit: "", condition: "",
    location: "", custodian: "", dateAcquired: "",
    cost: "", remarks: "",
  });

  const isLinked = Boolean(expenseRecordId);

  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const json = await getEquipment(id);
        const r = json.record || json.data || json;
        setForm({
          name: r.name || "",
          description: r.description || "",
          serialNo: r.serialNo || "",
          quantity: r.quantity ?? "",
          unit: r.unit || "",
          condition: r.condition || "",
          location: r.location || "",
          custodian: r.custodian || "",
          dateAcquired: r.dateAcquired || "",
          cost: r.cost ?? "",
          remarks: r.remarks || "",
        });
        setExpenseRecordId(r.expenseRecordId || null);
      } catch (err) {
        setError(err?.message || "Couldn't load this record.");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchRecord();
    else setLoading(false);
  }, [id]);

  useEffect(() => {
    const fetchCustodians = async () => {
      try {
        const json = await listPersonnel();
        const list = json.data || json.personnel || json.records || (Array.isArray(json) ? json : []);
        const names = [...new Set(list.map((p) => p.name || p.fullName).filter(Boolean))];
        setCustodians(names);
      } catch {
        setCustodians([]);
      }
    };
    fetchCustodians();
  }, []);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
  };

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

      await updateEquipment(id, form);
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { }
      navigate("/inventory/equipment");
    } catch (err) {
      setError(err?.message || "Couldn't save changes. Please try again.");
      setSaving(false);
    } finally {
      window.__pbSaving = false;
    }
  };

  if (loading) {
    return (
      <PageLayout background="#f4f4f2" breadcrumbItems={[{ label: "INVENTORY", path: "/inventory" }, { label: "EQUIPMENT & TOOLS", path: "/inventory/equipment" }, { label: "EDIT EQUIPMENT" }]}>
        <p className="pb-loading-text">Loading record...</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout background="#f4f4f2" breadcrumbItems={[{ label: "INVENTORY", path: "/inventory" }, { label: "EQUIPMENT & TOOLS", path: "/inventory/equipment" }, { label: "EDIT EQUIPMENT" }]}>

        <form className="eeq-form-card" onSubmit={handleSubmit}>

          {error && (
            <div className="pb-error-banner">
              {error}
            </div>
          )}

          <div className="eeq-section-header">
            <FiInfo />
            <h3>EQUIPMENT DETAILS</h3>
            <div className="eeq-line"></div>
          </div>

          <div className="eeq-form-grid">
            <div className="eeq-form-group">
              <label>Equipment/Tool Name <span className="eeq-req">*</span></label>
              <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="Enter equipment/tool name" disabled={isLinked} readOnly={isLinked} required />
            </div>

            <div className="eeq-form-group">
              <label>Serial/ID No.</label>
              <input type="text" name="serialNo" value={form.serialNo} onChange={handleChange} placeholder="Enter serial or ID number" disabled={isLinked} readOnly={isLinked} />
            </div>

            <div className="eeq-form-group eeq-full-width">
              <label>Description/Specifications <span className="eeq-req">*</span></label>
              <textarea name="description" value={form.description} onChange={handleChange} rows="3" placeholder="Enter description or specifications" disabled={isLinked} readOnly={isLinked} required />
            </div>
          </div>

          <div className="eeq-section-header">
            <FiPackage />
            <h3>STOCK &amp; CONDITION</h3>
            <div className="eeq-line"></div>
          </div>

          <div className="eeq-form-grid">
            <div className="eeq-form-group">
              <label>Quantity <span className="eeq-req">*</span></label>
              <input type="number" min="0" name="quantity" value={form.quantity} onChange={handleChange} onKeyDown={blockInvalidNumberKeys} onPaste={blockInvalidNumberPaste} placeholder="Enter quantity" disabled={isLinked} readOnly={isLinked} required />
            </div>

            <div className="eeq-form-group">
              <label>Unit <span className="eeq-req">*</span></label>
              <select name="unit" value={form.unit} onChange={handleChange} disabled={isLinked} required>
                <option value="">Select unit</option>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div className="eeq-form-group">
              <label>Condition <span className="eeq-req">*</span></label>
              <select name="condition" value={form.condition} onChange={handleChange} required>
                <option value="">Select condition</option>
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="eeq-section-header">
            <FiMapPin />
            <h3>ASSIGNMENT &amp; ACQUISITION</h3>
            <div className="eeq-line"></div>
          </div>

          <div className="eeq-form-grid">
            <div className="eeq-form-group">
              <label>Location/Storage <span className="eeq-req">*</span></label>
              <input type="text" name="location" value={form.location} onChange={handleChange} placeholder="Enter location or storage area" required />
            </div>

            <div className="eeq-form-group">
              <label>Custodian/Assigned To {isOwner && <span className="eeq-req">*</span>}</label>
              {isOwner ? (
                <>
                  <input
                    type="text"
                    name="custodian"
                    list="eeq-custodian-list"
                    value={form.custodian}
                    onChange={handleChange}
                    placeholder="Type or pick a custodian name"
                    required
                  />
                  <datalist id="eeq-custodian-list">
                    {custodians.map((c) => <option key={c} value={c} />)}
                  </datalist>
                  {!custodians.length && (
                    <small>No personnel records yet — you can still type a name.</small>
                  )}
                </>
              ) : (
                <input type="text" value={form.custodian || "—"} disabled readOnly />
              )}
              {!isOwner && <small>Only the Owner can change the custodian.</small>}
            </div>

            {isOwner && (
              <div className="eeq-form-group">
                <label>Date Acquired <span className="eeq-req">*</span></label>
                <input type="date" name="dateAcquired" value={form.dateAcquired ? new Date(form.dateAcquired).toISOString().split("T")[0] : ""} onChange={handleChange} disabled={isLinked} readOnly={isLinked} required />
              </div>
            )}

            {canSeeFinancials && (
              <div className="eeq-form-group">
                <label>Acquisition Cost <span className="eeq-req">*</span></label>
                <div className="eeq-input-with-prefix">
                  <span className="eeq-prefix">₱</span>
                  <input type="number" min="0" step="0.01" name="cost" value={form.cost} onChange={handleChange} onKeyDown={blockInvalidNumberKeys} onPaste={blockInvalidNumberPaste} placeholder="0.00" disabled={isLinked} readOnly={isLinked} required />
                </div>
              </div>
            )}
          </div>

          <div className="eeq-section-header">
            <FiFileText />
            <h3>ADDITIONAL</h3>
            <div className="eeq-line"></div>
          </div>

          <div className="eeq-form-group eeq-full-width">
            <label>Remarks</label>
            <textarea name="remarks" value={form.remarks} onChange={handleChange} rows="4" placeholder="Enter remarks (optional)" maxLength={255} />
            <small>{(form.remarks || "").length} / 255</small>
          </div>

          <div className="eeq-form-actions">
            <button type="button" className="eeq-cancel-btn" onClick={() => navigate("/inventory/equipment")}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="eeq-save-btn">
              <FiSave />
              Update Record
            </button>
          </div>
        </form>

    </PageLayout>
  );
}