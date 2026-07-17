import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiSave, FiX, FiFileText, FiUpload, FiInfo } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditExpense.css";

// Same resource name used by AddExpense.jsx / ExpensesRecord.jsx so all
// three pages read/write the same "pb_expenses" bucket in mockApi.js.
const API_BASE = "/api/v1/expenses";

const CATEGORIES = [
  "Feed Purchase", "Medicine", "Utilities", "Labor",
  "Equipment", "Transportation", "Miscellaneous",
];

export default function EditExpense() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    date: "", category: "", amount: "", receipt: null, remarks: "",
  });
  const [preview, setPreview] = useState("");      // newly chosen image
  const [existingReceipt, setExistingReceipt] = useState(""); // saved receipt filename

  // ── Fetch the existing record ──
  useEffect(() => {
    let cancelled = false;

    const fetchRecord = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/${id}`);

        let json;
        try {
          json = await res.json();
        } catch {
          throw new Error("Invalid response from server.");
        }

        if (cancelled) return;

        // mockApi.js returns the raw record directly (no {record}/{data}
        // wrapper) for a GET-by-id request.
        const rec = json?.record || json?.data || (json && !json.message ? json : null);

        if (res.ok && rec) {
          setForm((f) => ({
            ...f,
            date: rec.date ? String(rec.date).slice(0, 10) : "",
            category: rec.category || "",
            amount: rec.amount ?? "",
            remarks: rec.remarks || "",
            receipt: null,
          }));
          if (rec.receipt) setExistingReceipt(rec.receipt);
        } else {
          setError(json?.message || "Failed to load record.");
        }
      } catch (err) {
        console.error("EditExpense fetch error:", err);
        if (!cancelled) setError("Cannot connect to server. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRecord();
    return () => { cancelled = true; };
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
    setError("");
    setSuccess("");
    try {
      setSaving(true);

      // mockApi.js only understands a JSON string body (it does
      // JSON.parse(init.body) then spreads it onto the existing record).
      // FormData has no enumerable own properties when spread, so sending
      // it here silently produces a no-op update — that was the bug.
      const payload = {
        date: form.date,
        category: form.category,
        amount: Number(form.amount),
        remarks: form.remarks,
        // Keep the existing receipt filename unless the user picked a new file.
        receipt: form.receipt ? form.receipt.name : (existingReceipt || null),
      };

      const res = await fetch(`${API_BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setSuccess("Expense record updated successfully!");
        setTimeout(() => navigate("/sales-transactions/expenses"), 1000);
      } else {
        setError(data?.message || `Failed to update record (status ${res.status}).`);
      }
    } catch (err) {
      console.error("EditExpense submit error:", err);
      setError("Cannot connect to server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageLayout
        background="#f4f4f2"
        breadcrumbItems={[
          { label: "SALES & TRANSACTIONS", path: "/sales-transactions" },
          { label: "EXPENSES RECORD", path: "/sales-transactions/expenses" },
          { label: "EDIT EXPENSE" },
        ]}
      >
        <p style={{ color: "#aaa", fontFamily: "var(--font-body)" }}>Loading record...</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        { label: "SALES & TRANSACTIONS", path: "/sales-transactions" },
        { label: "EXPENSES RECORD", path: "/sales-transactions/expenses" },
        { label: "EDIT EXPENSE" },
      ]}
    >
        {success && <div className="ee-success-banner">{success}</div>}
        {error   && <div className="ee-error-banner">{error}</div>}

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
                  {form.receipt ? form.receipt.name : (existingReceipt || "No file chosen")}
                </span>
              </div>

              {/* New image preview */}
              {preview && (
                <div className="ee-file-preview">
                  <img src={preview} alt="Receipt preview" />
                  <button type="button" className="ee-file-remove" onClick={removeFile}>Remove</button>
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
              <button type="button" className="ee-cancel-btn" onClick={() => navigate("/sales-transactions/expenses")} disabled={saving}>
                <FiX /> Cancel
              </button>
              <button type="submit" disabled={saving} className="ee-save-btn">
                <FiSave /> {saving ? "Saving..." : "Update Record"}
              </button>
            </div>
          </div>

        </form>

    </PageLayout>
  );
}