import { FiPlus, FiTrash2 } from "react-icons/fi";
import "./SaleItemsEditor.css";
import { useLanguage } from "../i18n/LanguageContext";

const EGG_SIZES = ["Peewee", "Small", "Medium", "Large", "Extra Large", "Jumbo"];
const UNITS = ["Pieces", "Trays"];
const EGGS_PER_TRAY = 30;

export const emptyItem = () => ({ eggSize: "", unit: "Pieces", quantitySold: "", unitPrice: "" });

// Strip every keystroke down to digits only, live, as the user types —
// this is what actually stops "-", "e", "+", letters, "$", "₱", "%",
// commas, etc. from ever landing in the field, rather than allowing
// them and rejecting on submit. Quantity Sold is always a whole
// number, for both Pieces and Trays.
export function sanitizeWholeNumber(raw) {
  return String(raw ?? "").replace(/[^\d]/g, "");
}

// Digits plus at most ONE decimal point — used for Unit Price. Typing
// a second "." is simply dropped rather than accepted, and there is
// no way to type "-", letters, or any currency/percent symbol at all.
export function sanitizeDecimal(raw) {
  let v = String(raw ?? "").replace(/[^\d.]/g, "");
  const firstDot = v.indexOf(".");
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
  }
  return v;
}

// Final gate before submit — belt-and-suspenders on top of the
// character-level sanitizing above (covers paste-then-clear-then-empty
// edge cases, and gives Add/EditSalesRecord a single place to check
// before calling the API). The backend re-validates independently
// regardless — see computeItems() in salesRecordController.js.
export function validateItems(items) {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const label = `Egg Set ${i + 1}`;

    if (!it.eggSize) return `${label}: please select an egg size.`;
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
  }
  return null;
}

export function eggsEquivalentOf(item) {
  const qty = parseFloat(item.quantitySold) || 0;
  return item.unit === "Trays" ? qty * EGGS_PER_TRAY : qty;
}
export function subtotalOf(item) {
  const price = parseFloat(item.unitPrice) || 0;
  return Math.round(eggsEquivalentOf(item) * price * 100) / 100;
}

// `stockByType` — { [eggSize]: availableEggs }. For Edit, pass the
// RECORD'S OWN original items so this component can show the
// reversal-aware "effective available" (available + what this same
// item already accounts for) instead of flagging a false shortage on
// a sale that hasn't actually changed.
export default function SaleItemsEditor({ items, onChange, stockByType, originalItemsBySize }) {
  const { t: tr } = useLanguage();
  const updateItem = (index, field, value) => {
    const next = items.map((it, i) => (i === index ? { ...it, [field]: value } : it));
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
  const grandTotal = items.reduce((s, it) => s + subtotalOf(it), 0);

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
                <select value={item.eggSize} onChange={(e) => updateItem(i, "eggSize", e.target.value)} required>
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
                    onChange={(e) => updateItem(i, "unitPrice", sanitizeDecimal(e.target.value))}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="sie-form-group">
                <label>{tr("Eggs Equivalent")}</label>
                <input type="text" value={`${eggsEquivalentOf(item)} eggs`} disabled className="sie-readonly" />
              </div>

              <div className="sie-form-group">
                <label>{tr("Subtotal")}</label>
                <input type="text" value={`₱${subtotalOf(item).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`} disabled className="sie-readonly" />
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
          <strong>₱{grandTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>
    </div>
  );
}