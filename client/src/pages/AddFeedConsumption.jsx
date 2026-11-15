import { phToday } from "../phDate";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiInfo, FiFileText, FiSave, FiX, FiChevronDown } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./AddFeedConsumption.css";
import { createFeedConsumption } from "../api/feedConsumption";
import { listFlocks } from "../api/flockProfile";
import {
  useFeedStock,
  feedQuantityToKg,
  convertFeedQuantity,
  sackWeightHint,
  splitByBirds,
  batchFeedSuggestion,
} from "../hooks/useFeedStock";
import { useLanguage } from "../i18n/LanguageContext";

const FEED_TYPES = ["Grower Feed", "Layer Feed"];

// Today's date as YYYY-MM-DD, used as the max for date inputs so users
// can't pick a future date.
const getTodayDateString = () => {
  return phToday();
};

// Blocks "-", "+", "e"/"E" from being typed into the Quantity Consumed
// input — it must be a non-negative number with up to 2 decimal places.
const QUANTITY_PATTERN = /^(\d+(\.\d{1,2})?|\.\d{1,2})$/;

const blockInvalidQuantityKeys = (e) => {
  if (["-", "+", "e", "E"].includes(e.key)) {
    e.preventDefault();
  }
};

// Rejects anything pasted that isn't a plain number with up to 2 decimals.
const blockInvalidQuantityPaste = (e) => {
  const text = e.clipboardData.getData("text");
  if (!/^\d*\.?\d{0,2}$/.test(text)) {
    e.preventDefault();
  }
};

/**
 * Batch ID dropdown with checkboxes (Add + Edit Feed Consumption).
 * - "Select All" at the top selects every listed batch, or clears them all
 *   when all are selected; it shows a partial (indeterminate) state when
 *   only some are selected.
 * - Stays open while ticking boxes; closes on an outside click / tap, Escape,
 *   or clicking the field again.
 * - The field shows the selected IDs (and how many when several are picked).
 * - Each ID can be selected only once; the selection is kept in list order.
 */
export function BatchMultiSelect({ options, value, onChange, placeholder = "Select batch", emptyText = "No batches available" }) {
  const { t: tr } = useLanguage();
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const allRef = useRef(null);

  const picked = options.filter((id) => value.includes(id));
  const allSelected = options.length > 0 && picked.length === options.length;
  const someSelected = picked.length > 0 && !allSelected;

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someSelected;
  }, [someSelected, open]);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("touchstart", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("touchstart", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  // Keeps the order of the list and never repeats an ID. IDs that are not in
  // the list (e.g. a culled batch already on an entry being edited) stay.
  const ordered = (ids) => [
    ...value.filter((id) => !options.includes(id) && ids.includes(id)),
    ...options.filter((id) => ids.includes(id)),
  ];
  const toggle = (id) => onChange(ordered(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]));
  const toggleAll = () =>
    onChange(allSelected ? value.filter((id) => !options.includes(id)) : ordered([...new Set([...value, ...options])]));

  const shown = value.length <= 3 ? value.join(", ") : `${value.slice(0, 2).join(", ")} +${value.length - 2} ${tr("more")}`;

  return (
    <div className="afc-ms" ref={boxRef}>
      <button
        type="button"
        className={`afc-ms-field${open ? " is-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={!options.length && !value.length}
      >
        <span className={`afc-ms-text${value.length ? "" : " is-placeholder"}`}>
          {value.length ? shown : tr(options.length ? placeholder : emptyText)}
        </span>
        {value.length > 1 && <span className="afc-ms-count">{value.length} {tr("selected")}</span>}
        <FiChevronDown className="afc-ms-caret" aria-hidden="true" />
      </button>

      {open && (
        <div className="afc-ms-panel" role="listbox" aria-multiselectable="true">
          {options.length > 0 && (
            <label className="afc-ms-option afc-ms-all">
              <input ref={allRef} type="checkbox" checked={allSelected} onChange={toggleAll} />
              <span>{tr("Select All")}</span>
              <small>{picked.length}/{options.length}</small>
            </label>
          )}
          {options.map((id) => (
            <label key={id} className="afc-ms-option" role="option" aria-selected={value.includes(id)}>
              <input type="checkbox" checked={value.includes(id)} onChange={() => toggle(id)} />
              <span>{id}</span>
            </label>
          ))}
          {!options.length && <p className="afc-ms-empty">{tr(emptyText)}</p>}
        </div>
      )}
    </div>
  );
}

// "B-001 12.5 kg · B-002 7.5 kg" -- how the total will be shared.
export function AllocationHint({ totalKg, batchIds, flockList }) {
  const { t: tr } = useLanguage();
  if (batchIds.length < 2) return null;
  const shares = totalKg > 0 ? splitByBirds(totalKg, batchIds, flockList) : [];
  return (
    <small className="afc-ms-hint">
      {tr("Quantity Consumed is the total for all selected batches (deducted once from stock), shared by bird count")}
      {shares.length ? ": " : "."}
      {shares.map((s, i) => (
        <span key={s.batchId}>
          {i > 0 && " · "}
          <strong>{s.batchId}</strong> {s.kg.toLocaleString()} kg{s.birds ? ` (${s.birds.toLocaleString()} ${tr("birds")})` : ""}
        </span>
      ))}
    </small>
  );
}

export default function AddFeedConsumption() {
  const { t: tr } = useLanguage();
  const navigate = useNavigate();

  const [batches, setBatches] = useState([]);
  const [saving, setSaving] = useState(false);
  const [flockList, setFlockList] = useState([]);
  const [selectedBatches, setSelectedBatches] = useState([]);
  const {
    loading: stockLoading,
    stockFor,
    sackWeightFor,
  } = useFeedStock();

  const [form, setForm] = useState({
    date: getTodayDateString(),
    feedType: "",
    quantityConsumed: "",
    quantityUnit: "kg",
    notes: "",
  });

  const [error, setError] = useState("");

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const json = await listFlocks();

        const list =
          json.data ||
          json.flocks ||
          json.records ||
          (Array.isArray(json) ? json : []);

        // Batches that can receive feed: not archived and not culled.
        const ids = [
          ...new Set(
            list
              .filter((f) => !f.isArchived && f.status !== "Culled")
              .map((f) => f.batchId)
              .filter(Boolean)
          ),
        ];

        setFlockList(list);
        setBatches(ids);
      } catch {
        setFlockList([]);
        setBatches([]);
      }
    };

    fetchBatches();
  }, []);

  // Only batches still in the available list count as selected, so the
  // selection follows the list if it changes.
  const activeBatches = selectedBatches.filter((id) => batches.includes(id));

  const selectedStock = form.feedType ? stockFor(form.feedType) : null;
  const sackWeightKg = sackWeightFor(form.feedType);

  const availableStockKg =
    form.feedType && !stockLoading
      ? Number(selectedStock?.availableKg || 0)
      : null;

  const requestedKg = feedQuantityToKg(
    form.quantityConsumed,
    form.quantityUnit,
    sackWeightKg
  );

  const exceedsStock =
    availableStockKg != null &&
    Math.round(requestedKg * 100) / 100 > availableStockKg;

  // Available stock converted to whichever unit the user currently has
  // selected for Quantity Consumed (sacks or kg).
  const availableStockInSelectedUnit =
    availableStockKg == null
      ? null
      : form.quantityUnit === "sacks"
      ? availableStockKg / sackWeightKg
      : availableStockKg;

  const formatAvailableStock = () => {
    if (availableStockInSelectedUnit == null) return "checking...";

    if (form.quantityUnit === "sacks") {
      return `${(
        Math.round(availableStockInSelectedUnit * 100) / 100
      ).toLocaleString()} sacks`;
    }

    return `${(
      Math.round(availableStockInSelectedUnit * 100) / 100
    ).toLocaleString()} kg`;
  };

  const handleChange = (e) => {
    const { name } = e.target;
    let value = e.target.value;
    // iOS date pickers ignore the `max` attribute, so enforce it here too.
    if (e.target.type === "date") {
      if (e.target.max && value > e.target.max) {
        value = e.target.max;
        setError(tr("Date cannot be a future date."));
      } else {
        setError("");
      }
    }

    if (name === "quantityUnit") {
      setForm((current) => ({
        ...current,
        quantityConsumed: convertFeedQuantity(
          current.quantityConsumed,
          current.quantityUnit,
          value,
          sackWeightFor(current.feedType)
        ),
        quantityUnit: value,
      }));

      return;
    }

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  // When the selected batches change: pull each batch's current age and bird
  // count, pick the feed type, and fill in the TOTAL Quantity Consumed for all
  // of them (each batch's birds x its age-based g/head/day), as the single
  // batch dropdown always did for one batch.
  const handleBatchesChange = (batchIds) => {
    setSelectedBatches(batchIds);
    const suggestion = batchFeedSuggestion(flockList, batchIds);

    if (suggestion.totalKg != null && suggestion.feedType) {
      setForm((current) => ({
        ...current,
        feedType: suggestion.feedType,
        quantityConsumed: convertFeedQuantity(
          String(suggestion.totalKg),
          "kg",
          current.quantityUnit,
          sackWeightFor(suggestion.feedType)
        ),
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (saving) return;

    if (!activeBatches.length) {
      setError(tr("Please select at least one Batch ID."));
      return;
    }

    if (form.date > getTodayDateString()) {
      setError(tr("The date cannot be in the future."));
      return;
    }

    if (
      !QUANTITY_PATTERN.test(String(form.quantityConsumed)) ||
      Number(form.quantityConsumed) <= 0
    ) {
      setError(tr("Please enter a valid quantity greater than 0 (up to 2 decimal places)."));
      return;
    }

    if (exceedsStock) {
      setError(
        `Quantity consumed cannot exceed the available feed stock (${formatAvailableStock()} of ${form.feedType} remaining).`
      );
      return;
    }

    // ONE entry for all selected batches; the server stores how the total
    // is shared (by bird count) and deducts the total from stock once.
    const suggestion = batchFeedSuggestion(flockList, activeBatches);
    const payload = {
      ...form,
      ...suggestion.singleMeta,
      batchIds: activeBatches,
      batchMeta: suggestion.batchMeta,
    };

    if (window.__pbSaving) return;

    window.__pbSaving = true;
    setSaving(true);
    setError("");

    try {
      await createFeedConsumption(payload);

      try {
        window.dispatchEvent(
          new Event("pb_data_changed")
        );
      } catch {
        // Ignore event errors
      }

      navigate("/inventory/feed-consumption");
    } catch (err) {
      setError(
        tr(err?.message ||
          "Couldn't save this record. Please try again.")
      );

      setSaving(false);
    } finally {
      window.__pbSaving = false;
    }
  };

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        {
          label: "INVENTORY",
          path: "/inventory",
        },
        {
          label: "FEED CONSUMPTION",
          path: "/inventory/feed-consumption",
        },
        {
          label: "ADD FEED CONSUMPTION",
        },
      ]}
    >
      <form
        className="afc-form-card"
        onSubmit={handleSubmit}
      >
        {error && (
          <div className="pb-error-banner">
            {error}
          </div>
        )}

        <div className="afc-section-header">
          <FiInfo />
          <h3>{tr("CONSUMPTION DETAILS")}</h3>
          <div className="afc-line"></div>
        </div>

        <div className="afc-form-grid">
          <div className="afc-form-group">
            <label>{tr("Date")}{" "}<span className="afc-req">*</span>
            </label>

            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              max={getTodayDateString()}
              required
            />
          </div>

          <div className="afc-form-group">
            <label>{tr("Batch ID")}{" "}<span className="afc-req">*</span>
            </label>

            <BatchMultiSelect
              options={batches}
              value={activeBatches}
              onChange={handleBatchesChange}
            />
          </div>

          <div className="afc-form-group">
            <label>{tr("Feed Type")}{" "}<span className="afc-req">*</span>
            </label>

            <select
              name="feedType"
              value={form.feedType}
              onChange={handleChange}
              required
            >
              <option value="">{tr("Select feed type")}</option>

              {FEED_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="afc-form-group">
  <label>{tr("Quantity Consumed")}{" "}
    <span className="afc-req">*</span>
  </label>

  <div className="afc-quantity-input">
    <input
      type="number"
      min="0"
      step="0.01"
      name="quantityConsumed"
      value={form.quantityConsumed}
      onChange={handleChange}
      onKeyDown={blockInvalidQuantityKeys}
      onPaste={blockInvalidQuantityPaste}
      placeholder={tr("Enter quantity")}
      required
    />

    <select
      name="quantityUnit"
      value={form.quantityUnit}
      onChange={handleChange}
      aria-label={tr("Quantity unit")}
    >
      <option value="kg">{tr("kg")}</option>
      <option value="sacks">{tr("sacks")}</option>
    </select>
  </div>

  <small
    className={
      exceedsStock ? "afc-stock-warning" : ""
    }
  >
    {form.feedType
      ? `Available stock: ${formatAvailableStock()} of ${form.feedType}.${
          form.quantityUnit === "sacks" ? ` ${sackWeightHint("sacks", sackWeightKg)}` : ""
        }`
      : sackWeightHint("sacks", sackWeightKg)}
    {exceedsStock &&
      " Quantity consumed cannot exceed the available feed stock."}
  </small>
  <AllocationHint totalKg={requestedKg} batchIds={activeBatches} flockList={flockList} />
</div>
        </div>

        <div className="afc-section-header">
          <FiFileText />
          <h3>{tr("ADDITIONAL INFORMATION")}</h3>
          <div className="afc-line"></div>
        </div>

        <div className="afc-form-group afc-full-width">
          <label>{tr("Notes")}</label>

          <textarea
            rows="6"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            placeholder={tr("Enter notes about this consumption...")}
            maxLength={255}
          />

          <small>
            {form.notes.length} / 255
          </small>
        </div>

        {/* Same layout as the Flock Profile form: required-field note on the
            left, Cancel and Save grouped on the right. */}
        <div className="afc-form-actions">
          <p className="afc-req-note">{tr("Fields with * are required.")}</p>
          <div className="afc-action-btns">
            <button
              type="button"
              className="afc-cancel-btn"
              onClick={() =>
                navigate("/inventory/feed-consumption")
              }
              disabled={saving}
            >
              <FiX />{" "}{tr("Cancel")}</button>

            <button
              type="submit"
              disabled={saving || exceedsStock}
              className="afc-save-btn"
            >
              <FiSave /> {saving ? "Saving..." : "Save Record"}
            </button>
          </div>
        </div>
      </form>
    </PageLayout>
  );
}