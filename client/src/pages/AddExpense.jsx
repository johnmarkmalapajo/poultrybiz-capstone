import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSave, FiX, FiMenu, FiFileText, FiUpload, FiInfo } from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./AddExpense.css";

const CATEGORIES = [
  "Feed Purchase", "Medicine", "Utilities", "Labor",
  "Equipment", "Transportation", "Miscellaneous",
];

export default function AddExpense() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    date: "", category: "", amount: "", receipt: null, remarks: "",
  });
  const [preview, setPreview] = useState("");

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setForm((f) => ({ ...f, receipt: file }));
    if (file.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview("");
    }
  };

  const removeFile = () => {
    setForm((f) => ({ ...f, receipt: null }));
    setPreview("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // API integration here later (use FormData to send the receipt file)
    navigate("/sales-transactions/expenses");
  };

  return (
    <div className="ae-page">
      <Sidebar />

      <div className="ae-main">

        {/* Breadcrumb */}
        <div className="ae-breadcrumb">
          <button className="ae-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="ae-breadcrumb-link" onClick={() => navigate("/sales-transactions")}>
            SALES &amp; TRANSACTIONS
          </span>
          <span>›</span>
          <span className="ae-breadcrumb-link" onClick={() => navigate("/sales-transactions/expenses")}>
            EXPENSES RECORD
          </span>
          <span>›</span>
          <span className="ae-breadcrumb-current">ADD EXPENSE</span>
        </div>

        {/* Header */}
        <div className="ae-header">
          <div>
            <h2>Add Expense Record</h2>
            <p>Log a farm expense, including the category, amount, and an optional receipt.</p>
          </div>
        </div>

        <form className="ae-form-card" onSubmit={handleSubmit}>

          {/* EXPENSE DETAILS */}
          <div className="ae-section-header">
            <FiInfo />
            <h3>Expense Details</h3>
            <div className="ae-line" />
          </div>

          <div className="ae-form-grid">
            <div className="ae-form-group">
              <label>Expense Date <span className="req">*</span></label>
              <input type="date" name="date" value={form.date} onChange={handleChange} required />
            </div>

            <div className="ae-form-group">
              <label>Category <span className="req">*</span></label>
              <select name="category" value={form.category} onChange={handleChange} required>
                <option value="">Select category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="ae-form-group">
              <label>Amount <span className="req">*</span></label>
              <div className="ae-input-with-prefix">
                <span className="ae-prefix">₱</span>
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

            <div className="ae-form-group">
              <label>Receipt <span className="ae-optional">(optional)</span></label>
              <div className="ae-file-wrap">
                <label className="ae-file-btn">
                  <FiUpload /> Choose file
                  <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFile} hidden />
                </label>
                <span className="ae-file-name">
                  {form.receipt ? form.receipt.name : "No file chosen"}
                </span>
              </div>
              {preview && (
                <div className="ae-file-preview">
                  <img src={preview} alt="Receipt preview" />
                  <button type="button" className="ae-file-remove" onClick={removeFile}>Remove</button>
                </div>
              )}
              <small>Upload a receipt image or PDF (max 5MB). JPG, PNG, or PDF.</small>
            </div>
          </div>

          {/* ADDITIONAL DETAILS */}
          <div className="ae-section-header">
            <FiFileText />
            <h3>Additional Details</h3>
            <div className="ae-line" />
          </div>

          <div className="ae-form-group ae-full-width">
            <label>Remarks <span className="ae-optional">(optional)</span></label>
            <textarea
              name="remarks"
              value={form.remarks}
              onChange={handleChange}
              placeholder="Enter remarks or notes about this expense..."
              maxLength={255}
            />
            <small className="ae-char-count">{form.remarks.length} / 255</small>
          </div>

          {/* Actions */}
          <div className="ae-form-actions">
            <p className="ae-required-note">Fields with * are required.</p>
            <div className="ae-action-btns">
              <button type="button" className="ae-cancel-btn" onClick={() => navigate("/sales-transactions/expenses")}>
                <FiX /> Cancel
              </button>
              <button type="submit" className="ae-save-btn">
                <FiSave /> Save Record
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}