import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiInfo, FiShoppingCart, FiFileText, FiSave, FiX, FiUserPlus } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditSalesRecord.css";
import { getSalesRecord, updateSalesRecord, getEggStockSummary } from "../api/salesRecord";
import { listCustomers } from "../api/customers";
import SaleItemsEditor, { emptyItem, validateItems, eggsEquivalentOf } from "../components/SaleItemsEditor";

const NEW_CUSTOMER_VALUE = "__new__";

export default function EditSalesRecord() {
  const navigate = useNavigate();
  const { id }   = useParams();

  const [dateOfSale, setDateOfSale] = useState("");
  const [customers, setCustomers]   = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [recordBuyerName, setRecordBuyerName] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "" });
  const [items, setItems]           = useState([emptyItem()]);
  const [originalItemsBySize, setOriginalItemsBySize] = useState({});
  const [remarks, setRemarks]       = useState("");
  const [stockByType, setStockByType] = useState({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    listCustomers()
      .then((d) => setCustomers(d.customers || []))
      .catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    getEggStockSummary()
      .then((d) => {
        const map = {};
        (d.summary || []).forEach((s) => { map[s.eggSize] = s.available; });
        setStockByType(map);
      })
      .catch(() => setStockByType({}));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchRecord = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getSalesRecord(id);
        if (cancelled) return;

        const r = data?.data || data?.record || (data && !data.message ? data : null);

        if (r) {
          setDateOfSale((r.dateOfSale || "").split("T")[0] || "");
          setCustomerId(r.customer?._id || r.customer || "");
          setRecordBuyerName(r.customer?.name || r.buyer || "");

          const loadedItems = Array.isArray(r.items) && r.items.length > 0
            ? r.items.map((it) => ({
                eggSize: it.eggSize || "",
                unit: it.unit || "Pieces",
                quantitySold: it.quantitySold != null ? String(it.quantitySold) : "",
                unitPrice: it.unitPrice != null ? String(it.unitPrice) : "",
              }))
            : [emptyItem()];
          setItems(loadedItems);

          const bySize = {};
          loadedItems.forEach((it) => {
            if (!it.eggSize) return;
            bySize[it.eggSize] = (bySize[it.eggSize] || 0) + eggsEquivalentOf(it);
          });
          setOriginalItemsBySize(bySize);

          setRemarks(r.remarks || "");
        } else {
          setError(data?.message || "Failed to load record.");
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

  const isNewCustomer = customerId === NEW_CUSTOMER_VALUE;

  const anyStockExceeded = (() => {
    const requestedBySize = {};
    items.forEach((it) => {
      if (!it.eggSize) return;
      requestedBySize[it.eggSize] = (requestedBySize[it.eggSize] || 0) + eggsEquivalentOf(it);
    });
    return Object.entries(requestedBySize).some(([size, requested]) => {
      const base = stockByType[size];
      if (base == null) return false;
      const effective = base + (originalItemsBySize[size] || 0);
      return requested > effective;
    });
  })();

  const todayStr = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (dateOfSale && dateOfSale > todayStr()) {
      setError("Date cannot be a future date.");
      return;
    }
    if (saving) return;

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

    setSaving(true); setError(""); setSuccess("");
    try {
      await updateSalesRecord(id, payload);
      setSuccess("Sales record updated successfully!");
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { /* ignore */ }
      setTimeout(() => navigate("/sales-transactions/sales"), 1200);
    } catch (err) {
      setError(err?.message || "Cannot connect to server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const breadcrumbItems = [
    { label: "SALES AND TRANSACTIONS", path: "/sales-transactions" },
    { label: "SALES RECORD", path: "/sales-transactions/sales" },
    { label: "EDIT SALES RECORD" },
  ];

  if (loading) {
    return (
      <PageLayout background="#f4f4f2" breadcrumbItems={breadcrumbItems}>
        <div className="esr-loading">Loading sales record...</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout background="#f4f4f2" breadcrumbItems={breadcrumbItems}>
        {success && <div className="esr-success-banner">{success}</div>}
        {error   && <div className="esr-error-banner">{error}</div>}

        <form className="esr-form-card" onSubmit={handleSubmit}>

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
                value={dateOfSale}
                max={todayStr()}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v > todayStr()) {
                    setDateOfSale(todayStr());
                    setError("Date cannot be a future date.");
                  } else {
                    setDateOfSale(v);
                    setError("");
                  }
                }}
                required
              />
              <small>Select the date of the sale.</small>
            </div>

            <div className="esr-form-group">
              <label>Buyer / Customer <span className="req">*</span></label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
              >
                <option value="">Select buyer/customer</option>
                {customerId &&
                  customerId !== NEW_CUSTOMER_VALUE &&
                  !customers.some((c) => c._id === customerId) && (
                    <option value={customerId}>{recordBuyerName || "Current buyer"}</option>
                  )}
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
                <option value={NEW_CUSTOMER_VALUE}>+ New Customer</option>
              </select>
              <small>Previously recorded customers appear here automatically.</small>
            </div>
          </div>

          {isNewCustomer && (
            <div className="esr-form-grid">
              <div className="esr-form-group">
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

          <div className="esr-section-header">
            <FiShoppingCart />
            <h3>SALE DETAILS</h3>
            <div className="esr-line" />
          </div>

          <SaleItemsEditor
            items={items}
            onChange={setItems}
            stockByType={stockByType}
            originalItemsBySize={originalItemsBySize}
          />

          <div className="esr-section-header">
            <FiFileText />
            <h3>ADDITIONAL DETAILS (OPTIONAL)</h3>
            <div className="esr-line" />
          </div>

          <div className="esr-form-group esr-full-width">
            <label>Remarks</label>
            <textarea
              rows="5"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter any notes or additional information..."
            />
            <small>Add any remarks about this sale (optional).</small>
          </div>

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
              <button type="submit" className="esr-save-btn" disabled={saving || anyStockExceeded}>
                <FiSave />
                {saving ? "Saving..." : "Update Record"}
              </button>
            </div>
          </div>

        </form>

    </PageLayout>
  );
}