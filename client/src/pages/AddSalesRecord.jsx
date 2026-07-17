import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiInfo, FiShoppingCart, FiFileText, FiSave, FiX } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./AddSalesRecord.css";

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1"}/sales-records`;

function getToken() {
  return localStorage.getItem("token") || "";
}

export default function AddSalesRecord() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    dateOfSale: new Date().toISOString().split("T")[0],
    buyer: "",
    quantitySold: "",
    eggSize: "",
    unitPrice: "",
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

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
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ ...formData, totalAmount: parseFloat(totalAmount) }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess("Sales record saved successfully!");
        setTimeout(() => navigate("/sales-transactions/sales"), 1200);
      } else {
        setError(data.message || "Failed to save record.");
      }
    } catch {
      setError("Cannot connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        { label: "SALES & TRANSACTIONS", path: "/sales-transactions" },
        { label: "SALES RECORD", path: "/sales-transactions/sales" },
        { label: "ADD SALES RECORD" },
      ]}
    >
        {success && <div className="asr-success-banner">{success}</div>}
        {error   && <div className="asr-error-banner">{error}</div>}

        <form className="asr-form-card" onSubmit={handleSubmit}>

          <div className="asr-section-header">
            <FiInfo />
            <h3>BASIC INFORMATION</h3>
            <div className="asr-line" />
            </div>

            <div className="asr-form-grid">
              <div className="asr-form-group">
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

              <div className="asr-form-group">
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

            <div className="asr-section-header">
              <FiShoppingCart />
              <h3>SALE DETAILS</h3>
              <div className="asr-line" />
            </div>

            <div className="asr-form-grid">
              <div className="asr-form-group">
                <label>Quantity Sold (Trays) <span className="req">*</span></label>
                <div className="asr-input-with-unit">
                  <input
                    type="number"
                    min="1"
                    name="quantitySold"
                    value={formData.quantitySold}
                    onChange={handleChange}
                    placeholder="Enter quantity"
                    required
                  />
                  <span className="asr-unit-badge">trays</span>
                </div>
                <small>Enter the number of trays sold.</small>
              </div>

              <div className="asr-form-group">
                <label>Egg Size <span className="req">*</span></label>
                <select name="eggSize" value={formData.eggSize} onChange={handleChange} required>
                  <option value="">Select egg size</option>
                  {["Small","Medium","Large","Extra Large","Jumbo"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <small>Select the egg size category.</small>
              </div>

              <div className="asr-form-group">
                <label>Unit Price (Per Tray) <span className="req">*</span></label>
                <div className="asr-input-with-prefix">
                  <span className="asr-prefix">₱</span>
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

              <div className="asr-form-group">
                <label>Total Amount</label>
                <div className="asr-input-with-prefix">
                  <span className="asr-prefix">₱</span>
                  <input
                    type="text"
                    value={totalAmount}
                    readOnly
                    className="asr-readonly"
                  />
                </div>
                <small>Automatically computed (Quantity × Unit Price).</small>
              </div>
            </div>

            <div className="asr-section-header">
              <FiFileText />
              <h3>ADDITIONAL DETAILS (OPTIONAL)</h3>
              <div className="asr-line" />
            </div>

            <div className="asr-form-group asr-full-width">
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

            <div className="asr-form-actions">
              <p className="asr-required-note">* Fields with an asterisk are required.</p>
              <div className="asr-action-btns">
                <button
                  type="button"
                  className="asr-cancel-btn"
                  onClick={() => navigate("/sales-transactions/sales")}
                  disabled={loading}
                >
                  <FiX /> Cancel
                </button>
                <button type="submit" className="asr-save-btn" disabled={loading}>
                  <FiSave />
                  {loading ? "Saving..." : "Save Record"}
                </button>
              </div>
            </div>

          </form>

    </PageLayout>
  );
}