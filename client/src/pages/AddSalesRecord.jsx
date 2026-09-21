import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiInfo, FiShoppingCart, FiFileText, FiSave, FiX, FiUserPlus } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./AddSalesRecord.css";
import { createSalesRecord, getEggStockSummary } from "../api/salesRecord";
import { listCustomers } from "../api/customers";
import SaleItemsEditor, { emptyItem, validateItems } from "../components/SaleItemsEditor";

const NEW_CUSTOMER_VALUE = "__new__";

export default function AddSalesRecord() {
  const navigate = useNavigate();

  const [dateOfSale, setDateOfSale] = useState(new Date().toISOString().split("T")[0]);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "" });
  const [items, setItems] = useState([emptyItem()]);
  const [remarks, setRemarks] = useState("");
  const [stockByType, setStockByType] = useState({});

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    listCustomers()
      .then((d) => setCustomers(d.customers || []))
      .catch(() => setCustomers([]));
  }, []);

  // Live stock, so the item editor can warn before submitting. The
  // server independently re-validates on save regardless.
  useEffect(() => {
    getEggStockSummary()
      .then((d) => {
        const map = {};
        (d.summary || []).forEach((s) => { map[s.eggSize] = s.available; });
        setStockByType(map);
      })
      .catch(() => setStockByType({}));
  }, []);

  const isNewCustomer = customerId === NEW_CUSTOMER_VALUE;

  const anyStockExceeded = (() => {
    const requestedBySize = {};
    items.forEach((it) => {
      if (!it.eggSize) return;
      const qty = parseFloat(it.quantitySold) || 0;
      const eggs = it.unit === "Trays" ? qty * 30 : qty;
      requestedBySize[it.eggSize] = (requestedBySize[it.eggSize] || 0) + eggs;
    });
    return Object.entries(requestedBySize).some(
      ([size, requested]) => stockByType[size] != null && requested > stockByType[size]
    );
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!customerId) {
      setError("Please select a Buyer/Customer, or add a new one.");
      return;
    }
    if (isNewCustomer && !newCustomer.name.trim()) {
      setError("Please enter the new customer's name.");
      return;
    }
    const itemsError = validateItems(items);
    if (itemsError) {
      setError(itemsError);
      return;
    }
    if (anyStockExceeded) {
      setError("One or more egg sets exceed current available stock. Please adjust the quantities.");
      return;
    }

    const payload = {
      dateOfSale,
      items: items.map((it) => ({
        eggSize: it.eggSize,
        unit: it.unit,
        quantitySold: parseFloat(it.quantitySold) || 0,
        unitPrice: parseFloat(it.unitPrice) || 0,
      })),
      remarks,
      ...(isNewCustomer ? { newCustomer } : { customerId }),
    };

    setLoading(true); setError(""); setSuccess("");
    try {
      await createSalesRecord(payload);
      setSuccess("Sales record saved successfully!");
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { /* ignore */ }
      setTimeout(() => navigate("/sales-transactions/sales"), 1200);
    } catch (err) {
      setError(err?.message || "Cannot connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        { label: "SALES AND TRANSACTIONS", path: "/sales-transactions" },
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
                value={dateOfSale}
                onChange={(e) => setDateOfSale(e.target.value)}
                required
              />
              <small>Select the date of the sale.</small>
            </div>

            <div className="asr-form-group">
              <label>Buyer / Customer <span className="req">*</span></label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
              >
                <option value="">Select buyer/customer</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
                <option value={NEW_CUSTOMER_VALUE}>+ New Customer</option>
              </select>
              <small>Previously recorded customers appear here automatically.</small>
            </div>
          </div>

          {isNewCustomer && (
            <div className="asr-form-grid">
              <div className="asr-form-group">
                <label>Customer Name <span className="req">*</span></label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ name: e.target.value })}
                  placeholder="e.g. Juan Dela Cruz"
                  required
                />
                <small><FiUserPlus /> This customer will be saved and available for future sales.</small>
              </div>
            </div>
          )}

          <div className="asr-section-header">
            <FiShoppingCart />
            <h3>SALE DETAILS</h3>
            <div className="asr-line" />
          </div>

          <SaleItemsEditor items={items} onChange={setItems} stockByType={stockByType} />

          <div className="asr-section-header">
            <FiFileText />
            <h3>ADDITIONAL DETAILS (OPTIONAL)</h3>
            <div className="asr-line" />
          </div>

          <div className="asr-form-group asr-full-width">
            <label>Remarks</label>
            <textarea
              rows="5"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
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
              <button type="submit" className="asr-save-btn" disabled={loading || anyStockExceeded}>
                <FiSave />
                {loading ? "Saving..." : "Save Record"}
              </button>
            </div>
          </div>

        </form>

    </PageLayout>
  );
}