import { phToday } from "../phDate";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiInfo, FiShoppingCart, FiFileText, FiSave, FiX, FiUserPlus } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./AddSalesRecord.css";
import { createSalesRecord, getEggStockSummary, getEggPrices } from "../api/salesRecord";
import { listCustomers } from "../api/customers";
import SaleItemsEditor, { emptyItem, validateItems, configuredPriceText } from "../components/SaleItemsEditor";
import { useLanguage } from "../i18n/LanguageContext";

const NEW_CUSTOMER_VALUE = "__new__";

export default function AddSalesRecord() {
  const { t: tr } = useLanguage();
  const submitLock = useRef(false); // blocks a second click before React re-renders
  const navigate = useNavigate();

  const [dateOfSale, setDateOfSale] = useState(phToday());
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "" });
  const [items, setItems] = useState([emptyItem()]);
  const [remarks, setRemarks] = useState("");
  const [stockByType, setStockByType] = useState({});
  // Egg Pricing: { [eggSize]: price per egg | null }; null until loaded.
  const [eggPrices, setEggPrices] = useState(null);
  const [pricesError, setPricesError] = useState("");

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

  // The Owner's saved Egg Pricing fills each set's Unit Price as soon as an
  // Egg Size is chosen.
  useEffect(() => {
    getEggPrices()
      .then((d) => {
        const prices = d?.prices || {};
        setEggPrices(prices);
        // A size picked before the prices arrived gets its price now.
        setItems((current) => current.map((it) =>
          it.eggSize && it.unitPrice === ""
            ? { ...it, unitPrice: configuredPriceText(prices, it.eggSize), priceFromSettings: true }
            : it
        ));
      })
      .catch(() => setPricesError(tr("Couldn't load Egg Pricing. Enter the unit price manually or reload the page.")));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const noPricesSet = eggPrices && Object.values(eggPrices).every((v) => v == null);

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

  const todayStr = () => {
    return phToday();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (dateOfSale && dateOfSale > todayStr()) {
      setError(tr("Date cannot be a future date."));
      return;
    }
    if (loading || submitLock.current) return;

    if (!customerId) {
      setError(tr("Please select a Buyer/Customer, or add a new one."));
      return;
    }
    if (isNewCustomer && !newCustomer.name.trim()) {
      setError(tr("Please enter the new customer's name."));
      return;
    }
    const itemsError = validateItems(items, eggPrices);
    if (itemsError) {
      setError(itemsError);
      return;
    }
    if (anyStockExceeded) {
      setError(tr("One or more egg sets exceed current available stock. Please adjust the quantities."));
      return;
    }

    const payload = {
      dateOfSale,
      items: items.map((it) => ({
        eggSize: it.eggSize,
        unit: it.unit,
        quantitySold: parseFloat(it.quantitySold) || 0,
        // Sent as typed (e.g. "6.25"): never parsed to an integer or re-rounded.
        unitPrice: String(it.unitPrice ?? "").trim(),
      })),
      remarks,
      ...(isNewCustomer ? { newCustomer } : { customerId }),
    };

    submitLock.current = true;
    setLoading(true); setError(""); setSuccess("");
    try {
      await createSalesRecord(payload);
      setSuccess(tr("Sales record saved successfully!"));
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { /* ignore */ }
      setTimeout(() => navigate("/sales-transactions/sales"), 1200);
    } catch (err) {
      setError(tr(err?.message || "Cannot connect to server. Please try again."));
    } finally {
      submitLock.current = false;
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
            <h3>{tr("BASIC INFORMATION")}</h3>
            <div className="asr-line" />
          </div>

          <div className="asr-form-grid">
            <div className="asr-form-group">
              <label>{tr("Date of Sale")}{" "}<span className="req">*</span></label>
              <input
                type="date"
                value={dateOfSale}
                max={todayStr()}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v > todayStr()) {
                    setDateOfSale(todayStr());
                    setError(tr("Date cannot be a future date."));
                  } else {
                    setDateOfSale(v);
                    setError("");
                  }
                }}
                required
              />
              <small>{tr("Select the date of the sale.")}</small>
            </div>

            <div className="asr-form-group">
              <label>{tr("Buyer / Customer")}{" "}<span className="req">*</span></label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
              >
                <option value="">{tr("Select buyer/customer")}</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
                <option value={NEW_CUSTOMER_VALUE}>{tr("+ New Customer")}</option>
              </select>
              <small>{tr("Previously recorded customers appear here automatically.")}</small>
            </div>
          </div>

          {isNewCustomer && (
            <div className="asr-form-grid">
              <div className="asr-form-group">
                <label>{tr("Customer Name")}{" "}<span className="req">*</span></label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ name: e.target.value })}
                  placeholder={tr("e.g. Juan Dela Cruz")}
                  required
                />
                <small><FiUserPlus />{" "}{tr("This customer will be saved and available for future sales.")}</small>
              </div>
            </div>
          )}

          <div className="asr-section-header">
            <FiShoppingCart />
            <h3>{tr("SALE DETAILS")}</h3>
            <div className="asr-line" />
          </div>

          {noPricesSet && (
            <div className="asr-error-banner" role="alert">
              {tr("No egg prices are set yet. Set them with the Egg Pricing button on the Sales Record page.")}
            </div>
          )}
          {pricesError && <div className="asr-error-banner" role="alert">{pricesError}</div>}

          <SaleItemsEditor items={items} onChange={setItems} stockByType={stockByType} prices={eggPrices} />

          <div className="asr-section-header">
            <FiFileText />
            <h3>{tr("ADDITIONAL DETAILS (OPTIONAL)")}</h3>
            <div className="asr-line" />
          </div>

          <div className="asr-form-group asr-full-width">
            <label>{tr("Remarks")}</label>
            <textarea
              rows="5"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={tr("Enter any notes or additional information...")}
            />
            <small>{tr("Add any remarks about this sale (optional).")}</small>
          </div>

          <div className="asr-form-actions">
            <p className="asr-required-note">{tr("* Fields with an asterisk are required.")}</p>
            <div className="asr-action-btns">
              <button
                type="button"
                className="asr-cancel-btn"
                onClick={() => navigate("/sales-transactions/sales")}
                disabled={loading}
              >
                <FiX />{" "}{tr("Cancel")}</button>
              <button type="submit" className="asr-save-btn" disabled={loading || !!success || anyStockExceeded}>
                <FiSave />
                {loading ? "Saving..." : "Save Record"}
              </button>
            </div>
          </div>

        </form>

    </PageLayout>
  );
}