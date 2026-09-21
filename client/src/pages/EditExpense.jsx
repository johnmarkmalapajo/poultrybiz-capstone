import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiSave, FiX, FiFileText, FiUpload, FiInfo, FiTrash2 } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditExpense.css";
import { getExpenseRecord, updateExpenseRecord, uploadReceipt } from "../api/expenseRecord";

const CATEGORIES = [
  "Feed Purchase", "Medicine", "Utilities", "Labor",
  "Equipment", "Transportation", "Miscellaneous",
];

const FEED_SACK_WEIGHT_KG = 50;

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

const createFeedSet = () => ({
  feedType: "",
  unit: "Sacks",
  quantity: "",
  unitPrice: "",
});

const feedSetSubtotal = (feedSet) =>
  Number(feedSet.quantity || 0) * Number(feedSet.unitPrice || 0);

export default function EditExpense() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    date: "", category: "", amount: "", receipt: null, remarks: "",
    equipmentName: "", unit: "", quantity: "", serialNo: "", description: "",
    supplier: "",
  });

  const [feedSets, setFeedSets] = useState([createFeedSet()]);

  const isEquipment = form.category === "Equipment";
  const isFeedPurchase = form.category === "Feed Purchase";
  const [preview, setPreview] = useState("");
  const [existingReceipt, setExistingReceipt] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchRecord = async () => {
      setLoading(true);
      setError("");
      try {
        const json = await getExpenseRecord(id);

        if (cancelled) return;

        const rec = json?.record || json?.data || (json && !json.message ? json : null);

        if (rec) {
          setForm((f) => ({
            ...f,
            date: rec.date ? String(rec.date).slice(0, 10) : "",
            category: rec.category || "",
            amount: rec.amount ?? "",
            remarks: rec.remarks || "",
            receipt: null,
            equipmentName: rec.equipmentName || "",
            unit: rec.unit || "",
            quantity: rec.quantity ?? "",
            serialNo: rec.serialNo || "",
            description: rec.description || "",
            supplier: rec.supplier || "",
          }));

          if (rec.receipt) setExistingReceipt(rec.receipt);

          if (Array.isArray(rec.feedSets) && rec.feedSets.length > 0) {
            setFeedSets(
              rec.feedSets.map((fs) => ({
                feedType: fs.feedType || "",
                unit: fs.unit || "Sacks",
                quantity: fs.quantity ?? "",
                unitPrice: fs.unitPrice ?? "",
              }))
            );
          }
        } else {
          setError(json?.message || "Failed to load record.");
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Cannot connect to server. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRecord();
    return () => { cancelled = true; };
  }, [id]);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleFeedSetChange = (index, field, value) => {
    setFeedSets((current) =>
      current.map((fs, i) =>
        i === index ? { ...fs, [field]: value } : fs
      )
    );
  };

  const addFeedSet = () => {
    setFeedSets((current) => [...current, createFeedSet()]);
  };

  const removeFeedSet = (index) => {
    setFeedSets((current) =>
      current.length > 1
        ? current.filter((_, i) => i !== index)
        : current
    );
  };

  const feedPurchaseTotal = feedSets.reduce(
    (total, fs) => total + feedSetSubtotal(fs),
    0
  );

  const totalQuantityKg = feedSets.reduce((total, fs) => {
    const quantity = Number(fs.quantity || 0);
    if (fs.unit === "Sacks") {
      return total + quantity * FEED_SACK_WEIGHT_KG;
    }
    return total + quantity;
  }, 0);

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
    setSaving(true);
    try {
      if (isFeedPurchase) {
        if (!form.supplier.trim()) {
          throw new Error("Please enter the supplier name.");
        }

        const hasInvalidFeedSet = feedSets.some(
          (fs) =>
            !fs.feedType ||
            !fs.quantity ||
            Number.isNaN(Number(fs.quantity)) ||
            Number(fs.quantity) <= 0 ||
            !fs.unitPrice ||
            Number.isNaN(Number(fs.unitPrice)) ||
            Number(fs.unitPrice) < 0
        );

        if (hasInvalidFeedSet) {
          throw new Error("Please complete all required feed purchase fields.");
        }
      } else {
        if (
          form.amount === "" ||
          Number.isNaN(Number(form.amount)) ||
          Number(form.amount) < 0
        ) {
          throw new Error("Please enter a valid amount.");
        }
      }

      if (
        isEquipment &&
        (!form.quantity ||
          Number.isNaN(Number(form.quantity)) ||
          Number(form.quantity) <= 0)
      ) {
        throw new Error("Please enter a valid quantity.");
      }

      let uploadedReceiptPath = existingReceipt || null;

      if (form.receipt) {
        const uploadResult = await uploadReceipt(form.receipt);
        uploadedReceiptPath = uploadResult.receipt;
      }

      const payload = isFeedPurchase
        ? {
            date: form.date,
            category: "Feed Purchase",
            supplier: form.supplier.trim(),
            remarks: form.remarks,
            receipt: uploadedReceiptPath,
            amount: feedPurchaseTotal,
            feedSets: feedSets.map((fs) => ({
              feedType: fs.feedType,
              unit: fs.unit,
              quantity: Number(fs.quantity),
              unitPrice: Number(fs.unitPrice),
              amount: feedSetSubtotal(fs),
            })),
          }
        : {
            date: form.date,
            category: form.category,
            amount: Number(form.amount),
            remarks: form.remarks,
            receipt: uploadedReceiptPath,
            ...(isEquipment
              ? {
                  equipmentName: form.equipmentName.trim(),
                  unit: form.unit,
                  quantity: Number(form.quantity),
                  serialNo: form.serialNo.trim(),
                  description: form.description.trim(),
                }
              : {}),
          };

      await updateExpenseRecord(id, payload);
      setSuccess("Expense record updated successfully!");
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { /* ignore */ }
      setTimeout(() => navigate("/sales-transactions/expenses"), 1000);
    } catch (err) {
      setError(err?.message || "Cannot connect to server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageLayout
        background="#f4f4f2"
        breadcrumbItems={[
          { label: "SALES AND TRANSACTIONS", path: "/sales-transactions" },
          { label: "EXPENSES RECORD", path: "/sales-transactions/expenses" },
          { label: "EDIT EXPENSE" },
        ]}
      >
        <p className="pb-loading-text">Loading record...</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        { label: "SALES AND TRANSACTIONS", path: "/sales-transactions" },
        { label: "EXPENSES RECORD", path: "/sales-transactions/expenses" },
        { label: "EDIT EXPENSE" },
      ]}
    >
        {success && <div className="ee-success-banner">{success}</div>}
        {error   && <div className="ee-error-banner">{error}</div>}

        {(isEquipment || isFeedPurchase) && (
          <div className="ee-sync-banner">
            {isEquipment
              ? "Saving here will automatically update the connected Equipment & Tools record."
              : "Saving here will automatically update the connected Feed Inventory record(s)."}
          </div>
        )}

        <form className="ee-form-card" onSubmit={handleSubmit}>

          <div className="ee-section-header">
            <FiInfo />
            <h3>Expense Details</h3>
            <div className="ee-line" />
          </div>

          <div className="ee-form-grid">
            <div className="ee-form-group">
              <label>{isFeedPurchase ? "Date Purchased" : "Expense Date"} <span className="req">*</span></label>
              <input type="date" name="date" value={form.date} onChange={handleChange} required />
            </div>

            <div className="ee-form-group">
              <label>Category <span className="req">*</span></label>
              <select name="category" value={form.category} onChange={handleChange} required>
                <option value="">Select category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {isFeedPurchase && (
              <div className="ee-form-group">
                <label>Supplier <span className="req">*</span></label>
                <input type="text" name="supplier" value={form.supplier} onChange={handleChange} placeholder="Enter supplier name" required />
              </div>
            )}

            {!isFeedPurchase && (
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
                    onKeyDown={blockInvalidNumberKeys}
                    onPaste={blockInvalidNumberPaste}
                    placeholder="Enter amount"
                    required
                  />
                </div>
              </div>
            )}

            {isEquipment && (
              <>
                <div className="ee-form-group">
                  <label>Equipment/Tool Name <span className="req">*</span></label>
                  <input type="text" name="equipmentName" value={form.equipmentName} onChange={handleChange} required />
                </div>

                <div className="ee-form-group">
                  <label>Serial/ID No. <span className="ee-optional">(optional)</span></label>
                  <input type="text" name="serialNo" value={form.serialNo} onChange={handleChange} />
                </div>

                <div className="ee-form-group ee-full-width">
                  <label>Description/Specification <span className="req">*</span></label>
                  <textarea name="description" value={form.description} onChange={handleChange} rows="3" required />
                </div>

                <div className="ee-form-group">
                  <label>Quantity <span className="req">*</span></label>
                  <input type="number" name="quantity" min="0" value={form.quantity} onChange={handleChange} onKeyDown={blockInvalidNumberKeys} onPaste={blockInvalidNumberPaste} required />
                </div>

                <div className="ee-form-group">
                  <label>Unit <span className="req">*</span></label>
                  <select name="unit" value={form.unit} onChange={handleChange} required>
                    <option value="">Select unit</option>
                    <option value="pcs">pcs</option>
                    <option value="units">units</option>
                    <option value="sets">sets</option>
                    <option value="pairs">pairs</option>
                    <option value="kg">kg</option>
                    <option value="liters">liters</option>
                  </select>
                </div>
              </>
            )}

            {!isFeedPurchase && (
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

                {preview && (
                  <div className="ee-file-preview">
                    <img src={preview} alt="Receipt preview" />
                    <button type="button" className="ee-file-remove" onClick={removeFile}>Remove</button>
                  </div>
                )}

                <small>Upload a new receipt to replace the current one. JPG, PNG, or PDF (max 5MB).</small>
              </div>
            )}
          </div>

          {isFeedPurchase && (
            <>
              <div className="ee-section-header">
                <FiFileText />
                <h3>Feed Sets</h3>
                <div className="ee-line" />
              </div>

              {feedSets.map((fs, index) => (
                <div className="ee-feed-set-row" key={index}>
                  <div className="ee-form-grid">
                    <div className="ee-form-group">
                      <label>Feed Type <span className="req">*</span></label>
                      <select
                        value={fs.feedType}
                        onChange={(e) => handleFeedSetChange(index, "feedType", e.target.value)}
                        required
                      >
                        <option value="">Select feed type</option>
                        <option value="Layer Feed">Layer Feed</option>
                        <option value="Grower Feed">Grower Feed</option>
                      </select>
                    </div>

                    <div className="ee-form-group">
                      <label>Quantity <span className="req">*</span></label>
                      <div className="ee-quantity-unit">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={fs.quantity}
                          onChange={(e) => handleFeedSetChange(index, "quantity", e.target.value)}
                          onKeyDown={blockInvalidNumberKeys}
                          onPaste={blockInvalidNumberPaste}
                          placeholder="Enter quantity"
                          required
                        />
                        <select
                          value={fs.unit}
                          onChange={(e) => handleFeedSetChange(index, "unit", e.target.value)}
                          required
                        >
                          <option value="Sacks">sacks</option>
                          <option value="Kilogram">kg</option>
                        </select>
                      </div>
                      <small className="ee-unit-equivalent">
                        {fs.unit === "Sacks"
                          ? "1 sack is equal to 50 kg."
                          : "50 kg is equal to 1 sack."}
                      </small>
                    </div>

                    <div className="ee-form-group">
                      <label>Price per {fs.unit === "Sacks" ? "Sack" : "Kg"} <span className="req">*</span></label>
                      <div className="ee-input-with-prefix">
                        <span className="ee-prefix">₱</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={fs.unitPrice}
                          onChange={(e) => handleFeedSetChange(index, "unitPrice", e.target.value)}
                          onKeyDown={blockInvalidNumberKeys}
                          onPaste={blockInvalidNumberPaste}
                          placeholder="Enter price per unit"
                          required
                        />
                      </div>
                    </div>

                    <div className="ee-form-group">
                      <label>Subtotal</label>
                      <div className="ee-input-with-prefix">
                        <span className="ee-prefix">₱</span>
                        <input
                          type="text"
                          value={feedSetSubtotal(fs).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          placeholder="Subtotal"
                          disabled
                          readOnly
                        />
                      </div>
                    </div>

                    {index === 0 && (
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

                        {preview && (
                          <div className="ee-file-preview">
                            <img src={preview} alt="Receipt preview" />
                            <button type="button" className="ee-file-remove" onClick={removeFile}>Remove</button>
                          </div>
                        )}

                        <small>Upload a new receipt to replace the current one. JPG, PNG, or PDF (max 5MB).</small>
                      </div>
                    )}
                  </div>

                  {feedSets.length > 1 && (
                    <button
                      type="button"
                      className="ee-remove-feed-set-btn"
                      onClick={() => removeFeedSet(index)}
                    >
                      <FiTrash2 /> Remove Feed Set
                    </button>
                  )}
                </div>
              ))}

              <button type="button" className="ee-add-feed-set-btn" onClick={addFeedSet}>
                + Add Another Feed Set
              </button>

              <div className="ee-feed-summary">
                <div className="ee-summary-card">
                  <span>Total Quantity</span>
                  <strong>{totalQuantityKg.toLocaleString()} kg</strong>
                </div>

                <div className="ee-summary-card">
                  <span>Grand Total</span>
                  <strong>
                    ₱
                    {feedPurchaseTotal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                </div>
              </div>
            </>
          )}

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