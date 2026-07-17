import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSave, FiX, FiFileText, FiUpload, FiInfo } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./AddExpense.css";

// mockApi.js intercepts any fetch to "/api/..." — the URL below matches its
// resource-detection regex (/api/(v#/)?RESOURCE) so it gets routed to the
// "expenses" bucket in localStorage (see RESOURCE_KEYS -> "pb_expenses").
const API_BASE = "/api/v1/expenses";

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError("");
    setSuccess("");
    if (window.__pbSaving) return;  // prevent duplicate submissions
    window.__pbSaving = true;
    try {
      setSaving(true);

      // mockApi.js only understands a JSON string body (it does
      // JSON.parse(init.body)) — it can't read a File's contents, so we
      // just keep the receipt's filename as a plain string field instead
      // of sending FormData/multipart.
      const payload = {
        date: form.date,
        category: form.category,
        amount: Number(form.amount),
        remarks: form.remarks,
        receipt: form.receipt ? form.receipt.name : null,
      };

      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      // mockApi's POST handler returns the raw saved record (no "success"
      // field) — so the real signal of success is the HTTP status (res.ok),
      // not data.success.
      if (res.ok) {
        setSuccess("Expense record saved successfully!");
        setForm({ date: "", category: "", amount: "", receipt: null, remarks: "" });
        setPreview("");
        setTimeout(() => navigate("/sales-transactions/expenses"), 1000);
      } else {
        setError(data?.message || `Failed to save record (status ${res.status}).`);
      }
    } catch (err) {
      console.error("AddExpense submit error:", err);
      setError("Cannot connect to server. Please try again.");
    } finally {
      setSaving(false);
      window.__pbSaving = false;
    }
  };

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        { label: "SALES & TRANSACTIONS", path: "/sales-transactions" },
        { label: "EXPENSES RECORD", path: "/sales-transactions/expenses" },
        { label: "ADD EXPENSE" },
      ]}
    >
        {success && <div className="ae-success-banner">{success}</div>}
        {error   && <div className="ae-error-banner">{error}</div>}

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
              <button type="button" className="ae-cancel-btn" onClick={() => navigate("/sales-transactions/expenses")} disabled={saving}>
                <FiX /> Cancel
              </button>
              <button type="submit" disabled={saving} className="ae-save-btn">
                <FiSave /> {saving ? "Saving..." : "Save Record"}
              </button>
            </div>
          </div>

        </form>

    </PageLayout>
  );
}