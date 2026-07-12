import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiSave, FiX, FiMenu, FiFileText, FiUpload, FiInfo } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./EditExpense.css";

const API = (import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1");

const CATEGORIES = [
  "Feed Purchase", "Medicine", "Utilities", "Labor",
  "Equipment", "Transportation", "Miscellaneous",
];

export default function EditExpense() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    date: "", category: "", amount: "", receipt: null, remarks: "",
  });
  const [preview, setPreview] = useState("");      // newly chosen image
  const [existingReceipt, setExistingReceipt] = useState(""); // saved receipt URL

  // ── Fetch the existing record ──
  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/expense-records/${id}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await res.json();
        const rec = json.record || json.data || json;
        setForm((f) => ({
          ...f,
          date: rec.date ? String(rec.date).slice(0, 10) : "",
          category: rec.category || "",
          amount: rec.amount ?? "",
          remarks: rec.remarks || "",
          receipt: null,
        }));
        if (rec.receipt) setExistingReceipt(rec.receipt);
      } catch {
        /* keep empty form if fetch fails */
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setForm((f) => ({ ...f, receipt: file }));
    setPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : "");
  };

  const removeFile = () => {
    setForm((f) => ({ ...f, receipt: null }));
    setPreview("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    try {
      const token = localStorage.getItem("token");
      // Use FormData so the receipt file can be uploaded if changed
      const body = new FormData();
      body.append("date", form.date);
      body.append("category", form.category);
      body.append("amount", form.amount);
      body.append("remarks", form.remarks);
      if (form.receipt) body.append("receipt", form.receipt);

      setSaving(true);
      await fetch(`${API}/expense-records/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
    } catch {
      setSaving(false);
      /* silent — adjust endpoint to your backend */
    }
    navigate("/sales-transactions/expenses");
  };

  if (loading) {
    return (
      <div className="ee-page">
        <Sidebar />
        <div className="ee-main">
          <p style={{ color: "#aaa", fontFamily: "var(--font-body)" }}>Loading record...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ee-page">
      <Sidebar />

      <div className="ee-main">

        {/* Breadcrumb */}
        <div className="ee-breadcrumb">
          <button className="ee-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="ee-breadcrumb-link" onClick={() => navigate("/sales-transactions")}>
            SALES &amp; TRANSACTIONS
          </span>
          <span>›</span>
          <span className="ee-breadcrumb-link" onClick={() => navigate("/sales-transactions/expenses")}>
            EXPENSES RECORD
          </span>
          <span>›</span>
          <span className="ee-breadcrumb-current">EDIT EXPENSE</span>
        </div>

        {/* Header */}

        <form className="ee-form-card" onSubmit={handleSubmit}>

          {/* EXPENSE DETAILS */}
          <div className="ee-section-header">
            <FiInfo />
            <h3>Expense Details</h3>
            <div className="ee-line" />
          </div>

          <div className="ee-form-grid">
            <div className="ee-form-group">
              <label>Expense Date <span className="req">*</span></label>
              <input type="date" name="date" value={form.date} onChange={handleChange} required />
            </div>

            <div className="ee-form-group">
              <label>Category <span className="req">*</span></label>
              <select name="category" value={form.category} onChange={handleChange} required>
                <option value="">Select category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="ee-form-group">
              <label>Amount <span className="req">*</span></label>
              <div className="ee-input-with-prefix">
                <span className="ee-prefix">₱</span>
                <input
                  type="number"
                  name="amount"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={handleChange}
                  placeholder="Enter amount"
                  required
                />
              </div>
            </div>

            <div className="ee-form-group">
              <label>Receipt <span className="ee-optional">(optional)</span></label>
              <div className="ee-file-wrap">
                <label className="ee-file-btn">
                  <FiUpload /> Choose file
                  <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFile} hidden />
                </label>
                <span className="ee-file-name">
                  {form.receipt ? form.receipt.name : (existingReceipt ? "Current receipt on file" : "No file chosen")}
                </span>
              </div>

              {/* New image preview */}
              {preview && (
                <div className="ee-file-preview">
                  <img src={preview} alt="Receipt preview" />
                  <button type="button" className="ee-file-remove" onClick={removeFile}>Remove</button>
                </div>
              )}

              {/* Existing saved receipt (if no new file chosen) */}
              {!preview && existingReceipt && (
                <div className="ee-file-preview">
                  <img src={existingReceipt} alt="Current receipt" />
                  <a href={existingReceipt} target="_blank" rel="noreferrer" className="ee-view-link">View current</a>
                </div>
              )}

              <small>Upload a new receipt to replace the current one. JPG, PNG, or PDF (max 5MB).</small>
            </div>
          </div>

          {/* ADDITIONAL DETAILS */}
          <div className="ee-section-header">
            <FiFileText />
            <h3>Additional Details</h3>
            <div className="ee-line" />
          </div>

          <div className="ee-form-group ee-full-width">
            <label>Remarks <span className="ee-optional">(optional)</span></label>
            <textarea
              name="remarks"
              value={form.remarks}
              onChange={handleChange}
              placeholder="Enter remarks or notes about this expense..."
              maxLength={255}
            />
            <small className="ee-char-count">{(form.remarks || "").length} / 255</small>
          </div>

          {/* Actions */}
          <div className="ee-form-actions">
            <p className="ee-required-note">Fields with * are required.</p>
            <div className="ee-action-btns">
              <button type="button" className="ee-cancel-btn" onClick={() => navigate("/sales-transactions/expenses")}>
                <FiX /> Cancel
              </button>
              <button type="submit" disabled={saving} className="ee-save-btn">
                <FiSave /> Update Record
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
