import { FiPlus, FiTrash2 } from "react-icons/fi";
import "./SaleItemsEditor.css";
import { useLanguage } from "../i18n/LanguageContext";

// The egg sizes sold (same list as the server's SalesRecord egg sizes);
// also the rows of the Egg Pricing settings.
export const EGG_SIZES = ["Peewee", "Small", "Medium", "Large", "Extra Large", "Jumbo"];
const UNITS = ["Pieces", "Trays"];
const EGGS_PER_TRAY = 30;

export const emptyItem = () => ({ eggSize: "", unit: "Pieces", quantitySold: "", unitPrice: "" });

// ── Money, decimal-safe ──────────────────────────────────────────────────
// Unit prices may have up to 2 decimals (₱5.50, ₱6.25, ₱7.75, ₱10.99).
// Subtotals and totals are computed in whole centavos (integers), the same
// way the server does (salesRecordController.js), so e.g. 3 × ₱10.99 is
// exactly ₱32.97 with no floating-point drift. Prices are never rounded to
// whole pesos and never parsed with parseInt.
export const PRICE_2DP = /^\d+(\.\d{1,2})?$/;

// Centavos for `eggs` eggs at a unit price text, rounded half up to the
// centavo (exact integer math; only an old record can have > 2 decimals).
export function subtotalCentavos(eggs, priceText) {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(String(priceText ?? "").trim());
  if (!m) return 0;
  const frac = m[2] || "";
  if (frac.length > 6) return Math.round(eggs * Number(m[0]) * 100);
  const scaled = Number(m[1]) * 10 ** frac.length + Number(frac || 0);
  if (frac.length <= 2) return eggs * scaled * 10 ** (2 - frac.length);
  const den = 10 ** (frac.length - 2);
  return Math.floor((2 * eggs * scaled + den) / (2 * den));
}

// "₱1,234.50" — always two decimals.
export const formatPeso = (amount) =>
  `₱${(Number(amount) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// A saved price as Unit Price text: "6.5" → "6.50", 7 → "7.00". A value
// with more than 2 decimals (older record) is kept exactly as saved.
export function priceText(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const text = String(value).trim();
  if (PRICE_2DP.test(text)) return n.toFixed(2);
  return Number(n.toFixed(2)) === n ? n.toFixed(2) : String(n);
}

// Egg Pricing: the configured selling price per egg for a size, as the
// Unit Price text ("6.50"), or "" when no price is set for that size.
export const configuredPriceText = (prices, eggSize) => {
  const value = prices?.[eggSize];
  return typeof value === "number" && Number.isFinite(value) ? priceText(value) : "";
};

// An item still on its saved (historical) egg size keeps its own price;
// any other item must use a size that has a configured price.
const needsConfiguredPrice = (item, prices) =>
  Boolean(prices && item.eggSize && item.eggSize !== item.savedSize && configuredPriceText(prices, item.eggSize) === "");

// Strip every keystroke down to digits only, live, as the user types —
// this is what actually stops "-", "e", "+", letters, "$", "₱", "%",
// commas, etc. from ever landing in the field, rather than allowing
// them and rejecting on submit. Quantity Sold is always a whole
// number, for both Pieces and Trays.
export function sanitizeWholeNumber(raw) {
  return String(raw ?? "").replace(/[^\d]/g, "");
}

// Digits plus at most ONE decimal point and at most 2 decimal places —
// used for Unit Price and Egg Pricing. A second "." or a third decimal
// digit is simply dropped rather than accepted, and there is no way to
// type "-", letters, or any currency/percent symbol at all.
export function sanitizeDecimal(raw) {
  let v = String(raw ?? "").replace(/[^\d.]/g, "");
  const firstDot = v.indexOf(".");
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
  }
  return v;
}

// Final gate before submit — belt-and-suspenders on top of the
// character-level sanitizing above (covers paste-then-clear-then-empty
// edge cases, and gives Add/EditSalesRecord a single place to check
// before calling the API). The backend re-validates independently
// regardless — see computeItems() in salesRecordController.js.
export function validateItems(items, prices = null) {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const label = `Egg Set ${i + 1}`;

    if (!it.eggSize) return `${label}: please select an egg size.`;
    if (needsConfiguredPrice(it, prices)) {
      return `${label}: no selling price is set for ${it.eggSize} eggs. Set it in Egg Pricing first.`;
    }
    if (!it.unit) return `${label}: please select a unit.`;

    const qtyRaw = String(it.quantitySold ?? "").trim();
    if (qtyRaw === "") return `${label}: please enter a quantity.`;
    if (!/^\d+$/.test(qtyRaw)) {
      return `${label}: Quantity must be a whole number.`;
    }
    if (Number(qtyRaw) <= 0) return `${label}: quantity must be greater than zero.`;

    const priceRaw = String(it.unitPrice ?? "").trim();
    if (priceRaw === "") return `${label}: please enter a unit price.`;
    if (!/^\d+(\.\d+)?$/.test(priceRaw)) {
      return `${label}: Unit Price — please enter a valid number.`;
    }
    // An unchanged historical price is kept as saved; any other price has
    // at most 2 decimal places.
    if (!PRICE_2DP.test(priceRaw) && priceRaw !== String(it.savedUnitPrice ?? "")) {
      return `${label}: Unit Price — use up to 2 decimal places (e.g. 6.25).`;
    }
  }
  return null;
}

export function eggsEquivalentOf(item) {
  const qty = parseFloat(item.quantitySold) || 0;
  return item.unit === "Trays" ? qty * EGGS_PER_TRAY : qty;
}
export function subtotalCentavosOf(item) {
  return subtotalCentavos(eggsEquivalentOf(item), item.unitPrice);
}
export function subtotalOf(item) {
  return subtotalCentavosOf(item) / 100;
}

// `prices` — Egg Pricing { [eggSize]: price per egg | null }. When given,
// choosing an Egg Size fills that set's Unit Price with the configured
// price automatically (no extra click); the price can still be adjusted.
// Items loaded from a saved sale carry `savedSize` (their original size):
// their historical Unit Price is kept until their size is changed.
//
// `stockByType` — { [eggSize]: availableEggs }. For Edit, pass the
// RECORD'S OWN original items so this component can show the
// reversal-aware "effective available" (available + what this same
// item already accounts for) instead of flagging a false shortage on
// a sale that hasn't actually changed.
export default function SaleItemsEditor({ items, onChange, stockByType, originalItemsBySize, prices = null }) {
  const { t: tr } = useLanguage();
  const updateItem = (index, field, value) => {
    const next = items.map((it, i) => (i === index ? { ...it, [field]: value } : it));
    onChange(next);
  };
  // Egg Size change: the Unit Price follows the configured price of the
  // newly chosen size. Going back to a saved sale's original size restores
  // its historical price.
  const changeEggSize = (index, eggSize) => {
    const next = items.map((it, i) => {
      if (i !== index) return it;
      if (it.savedSize && eggSize === it.savedSize) {
        return { ...it, eggSize, unitPrice: it.savedUnitPrice ?? it.unitPrice, priceFromSettings: false };
      }
      if (!prices) return { ...it, eggSize };
      return { ...it, eggSize, unitPrice: configuredPriceText(prices, eggSize), priceFromSettings: true };
    });
    onChange(next);
  };
  const addItem = () => onChange([...items, emptyItem()]);
  const removeItem = (index) => onChange(items.filter((_, i) => i !== index));

  // Requested-so-far per size, ACROSS all rows in this form — so two
  // rows for the same size correctly stack against the same stock
  // limit instead of each being checked in isolation.
  const requestedBySize = {};
  items.forEach((it) => {
    if (!it.eggSize) return;
    requestedBySize[it.eggSize] = (requestedBySize[it.eggSize] || 0) + eggsEquivalentOf(it);
  });

  const effectiveAvailable = (eggSize) => {
    if (!eggSize || !stockByType) return null;
    const base = stockByType[eggSize];
    if (base == null) return null;
    const originalOwnAmount = originalItemsBySize?.[eggSize] || 0;
    return base + originalOwnAmount;
  };

  const totalEggs = items.reduce((s, it) => s + eggsEquivalentOf(it), 0);
  const grandTotal = items.reduce((s, it) => s + subtotalCentavosOf(it), 0) / 100;

  return (
    <div className="sie-wrap">
      {items.map((item, i) => {
        const avail = effectiveAvailable(item.eggSize);
        const requested = item.eggSize ? requestedBySize[item.eggSize] : 0;
        const exceeds = avail != null && requested > avail;

        return (
          <div className="sie-set" key={i}>
            <div className="sie-set-head">
              <span className="sie-set-label">{tr("Egg Set")}{" "}{i + 1}</span>
              {items.length > 1 && (
                <button type="button" className="sie-remove-btn" onClick={() => removeItem(i)} aria-label={tr("Remove this egg set")}>
                  <FiTrash2 />{" "}{tr("Remove")}</button>
              )}
            </div>

            <div className="sie-set-grid">
              <div className="sie-form-group">
                <label>{tr("Egg Size")}{" "}<span className="sie-req">*</span></label>
                <select value={item.eggSize} onChange={(e) => changeEggSize(i, e.target.value)} required>
                  <option value="">{tr("Select size")}</option>
                  {EGG_SIZES.map((s) => <option key={s} value={s}>{tr(s)}</option>)}
                </select>
              </div>

              <div className="sie-form-group">
                <label>{tr("Unit")}{" "}<span className="sie-req">*</span></label>
                <select value={item.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} required>
                  {UNITS.map((u) => <option key={u} value={u}>{tr(u)}</option>)}
                </select>
              </div>

              <div className="sie-form-group">
                <label>{tr("Quantity Sold")}{" "}<span className="sie-req">*</span></label>
                <input
                  type="text" inputMode="numeric"
                  value={item.quantitySold}
                  onChange={(e) => updateItem(i, "quantitySold", sanitizeWholeNumber(e.target.value))}
                  placeholder={item.unit === "Trays" ? tr("Number of trays") : tr("Number of pieces")}
                  required
                />
              </div>

              <div className="sie-form-group">
                <label>{tr("Unit Price (per egg)")}{" "}<span className="sie-req">*</span></label>
                <div className="sie-input-with-prefix">
                  <span className="sie-prefix">₱</span>
                  <input
                    type="text" inputMode="decimal"
                    value={item.unitPrice}
                    onChange={(e) => onChange(items.map((it, j) => (j === i ? { ...it, unitPrice: sanitizeDecimal(e.target.value), priceFromSettings: false } : it)))}
                    placeholder="0.00"
                    required
                  />
                </div>
                {needsConfiguredPrice(item, prices) ? (
                  <small className="sie-price-missing" role="alert">
                    {tr("No selling price is set for")}{" "}{tr(item.eggSize)}.{" "}{tr("Set it in Egg Pricing on the Sales Record page.")}
                  </small>
                ) : item.priceFromSettings && item.unitPrice !== "" ? (
                  <small className="sie-price-note">{tr("From Egg Pricing")}</small>
                ) : null}
              </div>

              <div className="sie-form-group">
                <label>{tr("Eggs Equivalent")}</label>
                <input type="text" value={`${eggsEquivalentOf(item)} eggs`} disabled className="sie-readonly" />
              </div>

              <div className="sie-form-group">
                <label>{tr("Subtotal")}</label>
                <input type="text" value={formatPeso(subtotalOf(item))} disabled className="sie-readonly" />
              </div>
            </div>

            {item.eggSize && avail != null && (
              <div className={`sie-stock-status ${exceeds ? "sie-stock-status-error" : ""}`}>
                <span>{tr("Available:")}{" "}<strong>{avail}{" "}{tr("eggs")}</strong></span>
                <span>{tr("Requested:")}{" "}<strong>{requested}{" "}{tr("eggs")}</strong></span>
                <span>{tr("Remaining:")}{" "}<strong>{Math.max(0, avail - requested)}{" "}{tr("eggs")}</strong></span>
              </div>
            )}

            {exceeds && (
              <div className="sie-set-error">{tr("Exceeds current")}{" "}{item.eggSize}{" "}{tr("stock — only")}{" "}{avail}{" "}{tr("eggs available,")}{" "}{requested}{" "}{tr("requested.")}</div>
            )}
          </div>
        );
      })}

      <button type="button" className="sie-add-btn" onClick={addItem}>
        <FiPlus />{" "}{tr("Add Another Egg Set")}</button>

      <div className="sie-totals">
        <div>
          <span>{tr("Total Eggs")}</span>
          <strong>{totalEggs.toLocaleString()}{" "}{tr("eggs")}</strong>
        </div>
        <div>
          <span>{tr("Grand Total")}</span>
          <strong>{formatPeso(grandTotal)}</strong>
        </div>
      </div>
    </div>
  );
}