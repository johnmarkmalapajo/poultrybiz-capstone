import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiInfo, FiPackage, FiMapPin, FiFileText, FiSave, FiMenu } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import { useUser } from "../hooks/useUser";
import "./EditEquipment.css";

const BASE_URL = "https://poultrybiz.onrender.com/api/v1";
const CONDITIONS = ["Good", "Fair", "Poor"];
const UNITS = ["pcs", "units", "sets", "pairs", "kg", "liters"];

export default function EditEquipment() {
  const navigate = useNavigate();
  const { canSeeFinancials } = useUser();

  const [custodians, setCustodians] = useState([]);
  const [form, setForm] = useState({
    name: "", description: "", serialNo: "",
    quantity: "", unit: "", condition: "",
    location: "", custodian: "", dateAcquired: "",
    cost: "", remarks: "",
  });

  // Load record set by the Edit button on the Equipment list
  useEffect(() => {
    const saved = localStorage.getItem("editEquipment");
    if (saved) {
      const r = JSON.parse(saved);
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
    }
  }, []);

  // Custodians from Personnel
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

  const handleSubmit = (e) => {
    e.preventDefault();
    localStorage.removeItem("editEquipment");
    navigate("/inventory/equipment");
  };

  return (
    <div className="edit-eq-page">
      <Sidebar />

      <div className="edit-eq-main">

        {/* Breadcrumb */}
        <div className="edit-eq-breadcrumb">
          <button className="edit-eq-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="breadcrumb-link" onClick={() => navigate("/inventory")}>INVENTORY</span>
          <span>›</span>
          <span className="breadcrumb-link" onClick={() => navigate("/inventory/equipment")}>EQUIPMENT &amp; TOOLS RECORD</span>
          <span>›</span>
          <span className="breadcrumb-current">EDIT EQUIPMENT</span>
        </div>

        {/* Header */}
        <div className="edit-eq-header">
          <div>
            <h2>Edit Equipment / Tool</h2>
            <p>Update the details of this equipment or tool record.</p>
          </div>
        </div>

        <form className="eq-form-card" onSubmit={handleSubmit}>

          {/* EQUIPMENT DETAILS */}
          <div className="section-header">
            <FiInfo />
            <h3>EQUIPMENT DETAILS</h3>
            <div className="line"></div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Equipment/Tool Name *</label>
              <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="Enter equipment/tool name" required />
            </div>

            <div className="form-group">
              <label>Serial/ID No.</label>
              <input type="text" name="serialNo" value={form.serialNo} onChange={handleChange} placeholder="Enter serial or ID number" />
            </div>

            <div className="form-group full-width">
              <label>Description/Specifications *</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows="3" placeholder="Enter description or specifications" required />
            </div>
          </div>

          {/* STOCK & CONDITION */}
          <div className="section-header">
            <FiPackage />
            <h3>STOCK &amp; CONDITION</h3>
            <div className="line"></div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Quantity *</label>
              <input type="number" min="0" name="quantity" value={form.quantity} onChange={handleChange} placeholder="Enter quantity" required />
            </div>

            <div className="form-group">
              <label>Unit *</label>
              <select name="unit" value={form.unit} onChange={handleChange} required>
                <option value="">Select unit</option>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Condition *</label>
              <select name="condition" value={form.condition} onChange={handleChange} required>
                <option value="">Select condition</option>
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* ASSIGNMENT & ACQUISITION */}
          <div className="section-header">
            <FiMapPin />
            <h3>ASSIGNMENT &amp; ACQUISITION</h3>
            <div className="line"></div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Location/Storage *</label>
              <input type="text" name="location" value={form.location} onChange={handleChange} placeholder="Enter location or storage area" required />
            </div>

            <div className="form-group">
              <label>Custodian/Assigned To *</label>
              <select name="custodian" value={form.custodian} onChange={handleChange} required>
                <option value="">{custodians.length ? "Select custodian" : "No personnel available"}</option>
                {/* keep the saved custodian visible even if personnel list is empty */}
                {form.custodian && !custodians.includes(form.custodian) && (
                  <option value={form.custodian}>{form.custodian}</option>
                )}
                {custodians.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Date Acquired *</label>
              <input type="date" name="dateAcquired" value={form.dateAcquired} onChange={handleChange} required />
            </div>

            {canSeeFinancials && (
              <div className="form-group">
                <label>Acquisition Cost *</label>
                <div className="eq-input-with-prefix">
                  <span className="eq-prefix">₱</span>
                  <input type="number" min="0" step="0.01" name="cost" value={form.cost} onChange={handleChange} placeholder="0.00" required />
                </div>
              </div>
            )}
          </div>

          {/* ADDITIONAL */}
          <div className="section-header">
            <FiFileText />
            <h3>ADDITIONAL</h3>
            <div className="line"></div>
          </div>

          <div className="form-group full-width">
            <label>Remarks</label>
            <textarea name="remarks" value={form.remarks} onChange={handleChange} rows="4" placeholder="Enter remarks (optional)" maxLength={255} />
            <small>{(form.remarks || "").length} / 255</small>
          </div>

          {/* Actions */}
          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={() => navigate("/inventory/equipment")}>
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