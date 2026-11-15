import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiInfo, FiFileText, FiSave, FiX } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditFeedConsumption.css";
import {
  getFeedConsumption,
  updateFeedConsumption,
} from "../api/feedConsumption";
import { listFlocks } from "../api/flockProfile";
import { useFeedStock, resolveSackWeight, batchFeedSuggestion } from "../hooks/useFeedStock";
import { useLanguage } from "../i18n/LanguageContext";
import { BatchMultiSelect, AllocationHint } from "./AddFeedConsumption";

const FEED_TYPES = ["Grower Feed", "Layer Feed"];
const QUANTITY_UNITS = ["sacks", "kg"];

// Feed plan by age, bird counts and the suggested total quantity come from
// the shared helpers in hooks/useFeedStock.js (batchFeedSuggestion), so
// Add and Edit always calculate the same way.

export default function EditFeedConsumption() {
  const { t: tr } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();

  const [batches, setBatches] = useState([]);
  const [flockList, setFlockList] = useState([]);
  // Batches on this entry. `batchesChanged` = the user changed them, so the
  // per-batch details are re-read from the flocks; otherwise the details
  // saved with the entry are kept.
  const [selectedBatches, setSelectedBatches] = useState([]);
  const [savedBatches, setSavedBatches] = useState([]);
  const [batchesChanged, setBatchesChanged] = useState(false);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    date: "",
    feedType: "",
    quantityConsumed: "",
    quantityUnit: "kg",
    notes: "",
  });

  const [savedSnapshot, setSavedSnapshot] = useState({
    feedType: "",
    sackWeightKg: null,
  });

  const { sackWeightFor } = useFeedStock();

  const sackWeightKg =
    savedSnapshot.feedType &&
    savedSnapshot.feedType.trim().toLowerCase() ===
      form.feedType.trim().toLowerCase()
      ? resolveSackWeight(savedSnapshot.sackWeightKg)
      : sackWeightFor(form.feedType);

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
        // (Batches already on this entry are always listed -- see below.)
        const ids = [
          ...new Set(
            list
              .filter((flock) => !flock.isArchived && flock.status !== "Culled")
              .map((flock) => flock.batchId)
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

  useEffect(() => {
    const fetchRecord = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const json = await getFeedConsumption(id);
        const record =
          json.record ||
          json.data ||
          json;

        const storedUnit = String(
          record.quantityUnit ||
            record.unit ||
            "kg"
        ).toLowerCase();

        const quantityUnit =
          storedUnit === "sacks"
            ? "sacks"
            : "kg";

        let quantityConsumed =
          record.quantityConsumed ?? "";

        if (
          quantityConsumed !== "" &&
          quantityConsumed !== null &&
          quantityConsumed !== undefined
        ) {
          const numericQuantity =
            Number(quantityConsumed);

          if (Number.isFinite(numericQuantity)) {
            quantityConsumed = String(
              Math.round(numericQuantity * 100) / 100
            );
          }
        }

        setForm({
          date: record.date
            ? new Date(record.date)
                .toISOString()
                .split("T")[0]
            : "",
          feedType: record.feedType || "",
          quantityConsumed,
          quantityUnit,
          notes: record.notes || "",
        });

        // Multi-batch entries list every batch; older single-batch entries
        // only have batchId.
        const recordBatches = record.batchIds?.length
          ? record.batchIds
          : record.batchId
          ? [record.batchId]
          : [];
        setSelectedBatches(recordBatches);
        setSavedBatches(recordBatches);

        setSavedSnapshot({
          feedType: record.feedType || "",
          sackWeightKg: record.sackWeightKg ?? null,
        });
      } catch (err) {
        setError(
          tr(err?.message ||
            "Couldn't load this record.")
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (event) => {
    const { name } = event.target;
    let value = event.target.value;
    // iOS date pickers ignore the `max` attribute, so enforce it here too.
    if (event.target.type === "date") {
      if (event.target.max && value > event.target.max) {
        value = event.target.max;
        setError(tr("Date cannot be a future date."));
      } else {
        setError("");
      }
    }

    if (name === "quantityConsumed") {
      if (value === "") {
        setForm((current) => ({
          ...current,
          quantityConsumed: "",
        }));

        return;
      }

      if (!/^\d*\.?\d{0,2}$/.test(value)) {
        return;
      }

      setForm((current) => ({
        ...current,
        quantityConsumed: value,
      }));

      return;
    }

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleQuantityUnitChange = (event) => {
    const unit = event.target.value;

    setForm((current) => ({
      ...current,
      quantityUnit: unit,
    }));
  };

  // Same as Add Feed Consumption: pick the feed type and fill in the TOTAL
  // quantity (kg) for all selected batches when every batch's age and bird
  // count are known.
  const handleBatchesChange = (batchIds) => {
    setSelectedBatches(batchIds);
    setBatchesChanged(true);
    const suggestion = batchFeedSuggestion(flockList, batchIds);

    if (suggestion.totalKg != null && suggestion.feedType) {
      setForm((current) => ({
        ...current,
        feedType: suggestion.feedType,
        quantityConsumed: String(suggestion.totalKg),
        quantityUnit: "kg",
      }));
    }
  };

  // Batches already on this entry stay selectable even if they were culled
  // or archived since.
  const batchOptions = [
    ...savedBatches.filter((id) => !batches.includes(id)),
    ...batches,
  ];

  const requestedKg =
    (Number(form.quantityConsumed) || 0) *
    (form.quantityUnit === "sacks" ? sackWeightKg : 1);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving || window.__pbSaving) {
      return;
    }

    setError("");

    if (!form.date) {
      setError(tr("Please select the date."));
      return;
    }

    if (!selectedBatches.length) {
      setError(tr("Please select at least one Batch ID."));
      return;
    }

    if (!form.feedType) {
      setError(tr("Please select a feed type."));
      return;
    }

    const quantity = Number(
      form.quantityConsumed || 0
    );

    if (
      !/^(\d+(\.\d{1,2})?|\.\d{1,2})$/.test(String(form.quantityConsumed)) ||
      quantity <= 0
    ) {
      setError(
        tr("Please enter a valid quantity greater than 0 (up to 2 decimal places).")
      );
      return;
    }

    window.__pbSaving = true;
    setSaving(true);

    try {
      const suggestion = batchesChanged
        ? batchFeedSuggestion(flockList, selectedBatches)
        : null;

      const payload = {
        date: form.date,
        batchIds: selectedBatches,
        feedType: form.feedType,
        quantityConsumed: quantity,
        quantityUnit: form.quantityUnit,
        ...(suggestion
          ? { ...suggestion.singleMeta, batchMeta: suggestion.batchMeta }
          : {}),
        notes: form.notes,
      };

      await updateFeedConsumption(
        id,
        payload
      );

      try {
        window.dispatchEvent(
          new Event("pb_data_changed")
        );
      } catch {}

      navigate("/inventory/feed-consumption");
    } catch (err) {
      setError(
        tr(err?.message ||
          "Couldn't save changes. Please try again.")
      );

      setSaving(false);
    } finally {
      window.__pbSaving = false;
    }
  };

  if (loading) {
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
            label: "EDIT FEED CONSUMPTION",
          },
        ]}
      >
        <p className="pb-loading-text">{tr("Loading record...")}</p>
      </PageLayout>
    );
  }

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
          label: "EDIT FEED CONSUMPTION",
        },
      ]}
    >
      <form
        className="efc-form-card"
        onSubmit={handleSubmit}
      >
        {error && (
          <div className="pb-error-banner">
            {error}
          </div>
        )}

        <div className="efc-section-header">
          <FiInfo />
          <h3>{tr("CONSUMPTION DETAILS")}</h3>
          <div className="efc-line"></div>
        </div>

        <div className="efc-form-grid">
          <div className="efc-form-group">
            <label>{tr("Date")}{" "}
              <span className="efc-req">*</span>
            </label>

            <input
              type="date"
              name="date"
              value={
                form.date
                  ? new Date(form.date)
                      .toISOString()
                      .split("T")[0]
                  : ""
              }
              onChange={handleChange}
              required
            />
          </div>

          <div className="efc-form-group">
            <label>{tr("Batch ID")}{" "}
              <span className="efc-req">*</span>
            </label>

            <BatchMultiSelect
              options={batchOptions}
              value={selectedBatches}
              onChange={handleBatchesChange}
            />
          </div>

          <div className="efc-form-group">
            <label>{tr("Feed Type")}{" "}
              <span className="efc-req">*</span>
            </label>

            <select
              name="feedType"
              value={form.feedType}
              onChange={handleChange}
              required
            >
              <option value="">{tr("Select feed type")}</option>

              {FEED_TYPES.map((feedType) => (
                <option
                  key={feedType}
                  value={feedType}
                >
                  {feedType}
                </option>
              ))}
            </select>
          </div>

          <div className="efc-form-group">
            <label>{tr("Quantity Consumed")}{" "}
              <span className="efc-req">*</span>
            </label>

            <div className="efc-quantity-input">
              <input
                type="number"
                min="0"
                step="0.01"
                name="quantityConsumed"
                value={form.quantityConsumed}
                onChange={handleChange}
                placeholder={tr("Enter quantity")}
                required
              />

              <select
                name="quantityUnit"
                value={form.quantityUnit}
                onChange={
                  handleQuantityUnitChange
                }
                aria-label={tr("Quantity unit")}
              >
                {QUANTITY_UNITS.map((unit) => (
                  <option
                    key={unit}
                    value={unit}
                  >
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            <small>
              {form.quantityUnit === "sacks"
                ? `1 sack = ${sackWeightKg} kg`
                : "Quantity is recorded in kilograms."}
            </small>
            <AllocationHint totalKg={requestedKg} batchIds={selectedBatches} flockList={flockList} />
          </div>
        </div>

        <div className="efc-section-header">
          <FiFileText />
          <h3>{tr("ADDITIONAL INFORMATION")}</h3>
          <div className="efc-line"></div>
        </div>

        <div className="efc-form-group efc-full-width">
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
            {(form.notes || "").length} / 255
          </small>
        </div>

        {/* Same layout as the Flock Profile form: required-field note on the
            left, Cancel and Update grouped on the right. */}
        <div className="efc-form-actions">
          <p className="efc-req-note">{tr("Fields with * are required.")}</p>
          <div className="efc-action-btns">
            <button
              type="button"
              className="efc-cancel-btn"
              onClick={() =>
                navigate(
                  "/inventory/feed-consumption"
                )
              }
              disabled={saving}
            >
              <FiX />{" "}{tr("Cancel")}</button>

            <button
              type="submit"
              disabled={saving}
              className="efc-save-btn"
            >
              <FiSave /> {saving ? "Updating..." : "Update Record"}
            </button>
          </div>
        </div>
      </form>
    </PageLayout>
  );
}