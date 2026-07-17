import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiInfo, FiShoppingCart, FiFileText, FiSave, FiX } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditSalesRecord.css";

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1"}/sales-records`;

function getToken() {
  return localStorage.getItem("token") || "";
}

export default function EditSalesRecord() {
  const navigate = useNavigate();
  const { id }   = useParams();

  const [formData, setFormData] = useState({
    dateOfSale:   "",
    buyer:        "",
    quantitySold: "",
    eggSize:      "",
    unitPrice:    "",
    notes:        "",
  });

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  // Fetch existing record
  useEffect(() => {
    let cancelled = false;

    const fetchRecord = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/${id}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });

        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error("Invalid response from server.");
        }

        if (cancelled) return;

        // Backend response shape can vary — accept { data }, { record },
        // or the record itself returned directly.
        const r = data?.data || data?.record || (data && !data.message ? data : null);

        if (res.ok && r) {
          setFormData({
            dateOfSale:   (r.dateOfSale || "").split("T")[0] || "",
            buyer:        r.buyer || "",
            quantitySold: r.quantitySold ?? "",
            eggSize:      r.eggSize || "",
            unitPrice:    r.unitPrice ?? "",
            notes:        r.notes || "",
          });
        } else {
          setError(data?.message || "Failed to load record.");
        }
      } catch (err) {
        console.error("EditSalesRecord fetch error:", err);
        if (!cancelled) setError("Cannot connect to server. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRecord();
    return () => { cancelled = true; };
  }, [id]);

  const totalAmount =
    formData.quantitySold && formData.unitPrice
      ? (parseFloat(formData.quantitySold) * parseFloat(formData.unitPrice)).toFixed(2)
      : "0.00";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body:    JSON.stringify({ ...formData, totalAmount: parseFloat(totalAmount) }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        /* some backends return no body on success — that's fine */
      }

      if (res.ok) {
        setSuccess("Sales record updated successfully!");
        setTimeout(() => navigate("/sales-transactions/sales"), 1200);
      } else {
        setError(data?.message || "Failed to update record.");
      }
    } catch (err) {
      console.error("EditSalesRecord submit error:", err);
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
          { label: "SALES RECORD", path: "/sales-transactions/sales" },
          { label: "EDIT SALES RECORD" },
        ]}
      >
        <div className="esr-loading">Loading sales record...</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        { label: "SALES & TRANSACTIONS", path: "/sales-transactions" },
        { label: "SALES RECORD", path: "/sales-transactions/sales" },
        { label: "EDIT SALES RECORD" },
      ]}
    >
        {/* Banners */}
        {success && <div className="esr-success-banner">{success}</div>}
        {error   && <div className="esr-error-banner">{error}</div>}

        <form className="esr-form-card" onSubmit={handleSubmit}>

          {/* BASIC INFORMATION */}
          <div className="esr-section-header">
            <FiInfo />
            <h3>BASIC INFORMATION</h3>
            <div className="esr-line" />
          </div>

          <div className="esr-form-grid">
            <div className="esr-form-group">
              <label>Date of Sale <span className="req">*</span></label>
              <input
                type="date"
                name="dateOfSale"
                value={formData.dateOfSale}
                onChange={handleChange}
                required
              />
              <small>Select the date of the sale.</small>
            </div>

            <div className="esr-form-group">
              <label>Buyer / Customer <span className="req">*</span></label>
              <input
                type="text"
                name="buyer"
                value={formData.buyer}
                onChange={handleChange}
                placeholder="Enter buyer name"
                required
              />
              <small>Enter existing buyer or add a new one.</small>
            </div>
          </div>

          {/* SALE DETAILS */}
          <div className="esr-section-header">
            <FiShoppingCart />
            <h3>SALE DETAILS</h3>
            <div className="esr-line" />
          </div>

          <div className="esr-form-grid">
            <div className="esr-form-group">
              <label>Quantity Sold (Trays) <span className="req">*</span></label>
              <div className="esr-input-with-unit">
                <input
                  type="number"
                  min="1"
                  name="quantitySold"
                  value={formData.quantitySold}
                  onChange={handleChange}
                  placeholder="Enter quantity"
                  required
                />
                <span className="esr-unit-badge">trays</span>
              </div>
              <small>Enter the number of trays sold.</small>
            </div>

            <div className="esr-form-group">
              <label>Egg Size <span className="req">*</span></label>
              <select name="eggSize" value={formData.eggSize} onChange={handleChange} required>
                <option value="">Select egg size</option>
                {["Small", "Medium", "Large", "Extra Large", "Jumbo"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <small>Select the egg size category.</small>
            </div>

            <div className="esr-form-group">
              <label>Unit Price (Per Tray) <span className="req">*</span></label>
              <div className="esr-input-with-prefix">
                <span className="esr-prefix">₱</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="unitPrice"
                  value={formData.unitPrice}
                  onChange={handleChange}
                  placeholder="0.00"
                  required
                />
              </div>
              <small>Enter the selling price per tray.</small>
            </div>

            <div className="esr-form-group">
              <label>Total Amount</label>
              <div className="esr-input-with-prefix">
                <span className="esr-prefix">₱</span>
                <input
                  type="text"
                  value={totalAmount}
                  readOnly
                  className="esr-readonly"
                />
              </div>
              <small>Automatically computed (Quantity × Unit Price).</small>
            </div>
          </div>

          {/* ADDITIONAL DETAILS */}
          <div className="esr-section-header">
            <FiFileText />
            <h3>ADDITIONAL DETAILS (OPTIONAL)</h3>
            <div className="esr-line" />
          </div>

          <div className="esr-form-group esr-full-width">
            <label>Notes</label>
            <textarea
              rows="5"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Enter any notes or additional information..."
            />
            <small>Add any remarks about this sale (optional).</small>
          </div>

          {/* Actions */}
          <div className="esr-form-actions">
            <p className="esr-required-note">* Fields with an asterisk are required.</p>
            <div className="esr-action-btns">
              <button
                type="button"
                className="esr-cancel-btn"
                onClick={() => navigate("/sales-transactions/sales")}
                disabled={saving}
              >
                <FiX /> Cancel
              </button>
              <button type="submit" className="esr-save-btn" disabled={saving}>
                <FiSave />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

        </form>

    </PageLayout>
  );
}