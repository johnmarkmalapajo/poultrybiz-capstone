import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiInfo, FiFileText, FiSave } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./AddFeedConsumption.css";
import { createFeedConsumption, listFeedConsumption } from "../api/feedConsumption";
import { listFeedInventory } from "../api/feedInventory";
import { listFlocks } from "../api/flockProfile";

const FEED_TYPES = ["Grower Feed", "Layer Feed"];
const FEED_SACK_WEIGHT_KG = 50;

// Today's date as YYYY-MM-DD, used as the max for date inputs so users
// can't pick a future date.
const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Blocks "-", "+", "e"/"E", "." from being typed into the Quantity
// Consumed input — it must be a whole non-negative number, no decimals.
const blockInvalidIntegerKeys = (e) => {
  if (["-", "+", "e", "E", "."].includes(e.key)) {
    e.preventDefault();
  }
};

// Rejects anything pasted that isn't purely digits (no decimals, no signs).
const blockInvalidIntegerPaste = (e) => {
  const text = e.clipboardData.getData("text");
  if (!/^\d*$/.test(text)) {
    e.preventDefault();
  }
};

// Mirrors the backend's stock calculation so the form can warn the user
// before they even try to submit.
const getQuantityInKg = (quantity, unit) => {
  const value = Number(quantity || 0);

  if (String(unit).toLowerCase() === "sacks") {
    return value * FEED_SACK_WEIGHT_KG;
  }

  return value;
};

// ── Feed transition rules by current age (weeks) ──
function getFeedPlan(week) {
  if (week == null || isNaN(week) || week < 17) return null;
  if (week === 17) return { grower: 100, layer: 0, gPerHead: 75 };
  if (week === 18) return { grower: 100, layer: 0, gPerHead: 85 };
  if (week === 19) return { grower: 75, layer: 25, gPerHead: 90 };
  if (week === 20) return { grower: 50, layer: 50, gPerHead: 95 };
  if (week === 21) return { grower: 25, layer: 75, gPerHead: 100 };
  if (week === 22) return { grower: 0, layer: 100, gPerHead: 105 };

  return {
    grower: 0,
    layer: 100,
    gPerHead: 110,
  };
}

function planLabel(p) {
  if (!p) return "";

  const parts = [];

  if (p.grower) {
    parts.push(`${p.grower}% Grower Feed`);
  }

  if (p.layer) {
    parts.push(`${p.layer}% Layer Feed`);
  }

  return `${parts.join(" + ")} (${p.gPerHead} g/head/day)`;
}

function primaryFeed(p) {
  if (!p) return "";

  return p.layer > p.grower ? "Layer Feed" : "Grower Feed";
}

// Current age (weeks)
function getAgeWeeks(f) {
  if (!f) return null;

  const direct =
    f.currentAgeWeeks ??
    f.ageWeeks ??
    f.currentAge ??
    f.ageInWeeks ??
    f.age;

  if (direct != null && direct !== "") {
    return Math.floor(Number(direct));
  }

  const start =
    f.dateAcquired ||
    f.startDate ||
    f.hatchDate ||
    f.dateOfArrival ||
    f.acquisitionDate;

  if (start) {
    const ms = Date.now() - new Date(start).getTime();

    if (!isNaN(ms)) {
      return Math.max(
        0,
        Math.floor(ms / (7 * 24 * 60 * 60 * 1000))
      );
    }
  }

  return null;
}

// Current quantity (head count)
function getQuantity(f) {
  if (!f) return null;

  const q =
    f.currentQuantity ??
    f.currentBirds ??
    f.quantity ??
    f.headCount ??
    f.quantityPurchased ??
    f.numberOfBirds ??
    f.birdCount;

  const n = Number(q);

  return isNaN(n) || n <= 0 ? null : n;
}

// Quantity consumed in kg
function computeConsumedKg(qty, plan) {
  if (!qty || !plan) return "";

  return String(
    Math.round((qty * plan.gPerHead / 1000) * 100) / 100
  );
}

// Convert quantity between kg and sacks
function convertQuantity(value, fromUnit, toUnit) {
  const quantity = Number(value);

  if (!value || isNaN(quantity)) {
    return "";
  }

  if (fromUnit === toUnit) {
    return String(quantity);
  }

  if (fromUnit === "kg" && toUnit === "sacks") {
    return String(
      Math.round((quantity / FEED_SACK_WEIGHT_KG) * 100) / 100
    );
  }

  if (fromUnit === "sacks" && toUnit === "kg") {
    return String(
      Math.round(quantity * FEED_SACK_WEIGHT_KG * 100) / 100
    );
  }

  return String(quantity);
}

export default function AddFeedConsumption() {
  const navigate = useNavigate();

  const [batches, setBatches] = useState([]);
  const [saving, setSaving] = useState(false);
  const [flockList, setFlockList] = useState([]);
  const [autoMeta, setAutoMeta] = useState({});
  const [inventoryRecords, setInventoryRecords] = useState([]);
  const [consumptionRecords, setConsumptionRecords] = useState([]);

  const [form, setForm] = useState({
    date: "",
    batchId: "",
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

        const ids = [
          ...new Set(
            list
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

  useEffect(() => {
    const fetchStockData = async () => {
      try {
        const [inventoryJson, consumptionJson] =
          await Promise.all([
            listFeedInventory(),
            listFeedConsumption(),
          ]);

        const inventoryList =
          inventoryJson.records ||
          inventoryJson.data ||
          (Array.isArray(inventoryJson)
            ? inventoryJson
            : []);

        const consumptionList =
          consumptionJson.records ||
          consumptionJson.data ||
          (Array.isArray(consumptionJson)
            ? consumptionJson
            : []);

        setInventoryRecords(
          inventoryList.filter((r) => !r.archived)
        );
        setConsumptionRecords(
          consumptionList.filter((r) => !r.archived)
        );
      } catch {
        setInventoryRecords([]);
        setConsumptionRecords([]);
      }
    };

    fetchStockData();
  }, []);

  // Stock currently available for the selected feed type, in kg.
  const availableStockKg = (() => {
    if (!form.feedType) return null;

    const feedType = form.feedType.trim().toLowerCase();

    const totalPurchasedSacks = inventoryRecords
      .filter(
        (r) =>
          String(r.feedType || "")
            .trim()
            .toLowerCase() === feedType
      )
      .reduce(
        (sum, r) => sum + Number(r.quantityIn || 0),
        0
      );

    const totalPurchasedKg =
      totalPurchasedSacks * FEED_SACK_WEIGHT_KG;

    const totalConsumedKg = consumptionRecords
      .filter(
        (r) =>
          String(r.feedType || "")
            .trim()
            .toLowerCase() === feedType
      )
      .reduce(
        (sum, r) =>
          sum +
          getQuantityInKg(
            r.quantityConsumed,
            r.quantityUnit
          ),
        0
      );

    return Math.max(
      0,
      totalPurchasedKg - totalConsumedKg
    );
  })();

  const requestedKg = getQuantityInKg(
    form.quantityConsumed,
    form.quantityUnit
  );

  const exceedsStock =
    availableStockKg != null &&
    requestedKg > availableStockKg;

  // Available stock converted to whichever unit the user currently has
  // selected for Quantity Consumed (sacks or kg).
  const availableStockInSelectedUnit =
    availableStockKg == null
      ? null
      : form.quantityUnit === "sacks"
      ? availableStockKg / FEED_SACK_WEIGHT_KG
      : availableStockKg;

  const formatAvailableStock = () => {
    if (availableStockInSelectedUnit == null) return "";

    if (form.quantityUnit === "sacks") {
      return `${(
        Math.round(availableStockInSelectedUnit * 100) / 100
      ).toLocaleString()} sacks`;
    }

    return `${Math.round(
      availableStockInSelectedUnit
    ).toLocaleString()} kg`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "quantityUnit") {
      setForm((current) => ({
        ...current,
        quantityConsumed: convertQuantity(
          current.quantityConsumed,
          current.quantityUnit,
          value
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

  // When a batch is selected:
  // pull current age + quantity from the flock,
  // auto-determine the feed transition,
  // and auto-compute Quantity Consumed.
  const handleBatchChange = (e) => {
    const batchId = e.target.value;
    const flock = flockList.find(
      (f) => f.batchId === batchId
    );

    const age = getAgeWeeks(flock);
    const qty = getQuantity(flock);
    const plan = getFeedPlan(age);

    setAutoMeta({
      currentAge: age,
      currentQuantity: qty,
      feedTransition: planLabel(plan),
      gPerHeadPerDay: plan?.gPerHead ?? null,
    });

    setForm((current) => {
      const next = {
        ...current,
        batchId,
      };

      if (plan && qty) {
        const consumedKg = computeConsumedKg(qty, plan);

        next.feedType = primaryFeed(plan);

        next.quantityConsumed = convertQuantity(
          consumedKg,
          "kg",
          current.quantityUnit
        );
      }

      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (saving) return;

    if (form.date > getTodayDateString()) {
      setError("The date cannot be in the future.");
      return;
    }

    if (
      !form.quantityConsumed ||
      Number.isNaN(Number(form.quantityConsumed)) ||
      !Number.isInteger(Number(form.quantityConsumed)) ||
      Number(form.quantityConsumed) <= 0
    ) {
      setError("Please enter a valid whole-number quantity.");
      return;
    }

    if (exceedsStock) {
      setError(
        `Quantity consumed cannot exceed the available feed stock (${formatAvailableStock()} of ${form.feedType} remaining).`
      );
      return;
    }

    const payload = {
      ...form,
      ...autoMeta,
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
        err?.message ||
          "Couldn't save this record. Please try again."
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
          <h3>CONSUMPTION DETAILS</h3>
          <div className="afc-line"></div>
        </div>

        <div className="afc-form-grid">
          <div className="afc-form-group">
            <label>
              Date <span className="afc-req">*</span>
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
            <label>
              Batch ID <span className="afc-req">*</span>
            </label>

            <select
              name="batchId"
              value={form.batchId}
              onChange={handleBatchChange}
              required
            >
              <option value="">
                {batches.length
                  ? "Select batch"
                  : "No batches available"}
              </option>

              {batches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="afc-form-group">
            <label>
              Feed Type <span className="afc-req">*</span>
            </label>

            <select
              name="feedType"
              value={form.feedType}
              onChange={handleChange}
              required
            >
              <option value="">
                Select feed type
              </option>

              {FEED_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="afc-form-group">
  <label>
    Quantity Consumed{" "}
    <span className="afc-req">*</span>
  </label>

  <div className="afc-quantity-input">
    <input
      type="number"
      min="0"
      step="1"
      name="quantityConsumed"
      value={form.quantityConsumed}
      onChange={handleChange}
      onKeyDown={blockInvalidIntegerKeys}
      onPaste={blockInvalidIntegerPaste}
      placeholder="Enter quantity"
      required
    />

    <select
      name="quantityUnit"
      value={form.quantityUnit}
      onChange={handleChange}
      aria-label="Quantity unit"
    >
      <option value="kg">kg</option>
      <option value="sacks">sacks</option>
    </select>
  </div>

  <small
    className={
      exceedsStock ? "afc-stock-warning" : ""
    }
  >
    {form.feedType
      ? `Available stock: ${formatAvailableStock()} of ${form.feedType}.`
      : "1 sack is equal to 50 kg."}
    {exceedsStock &&
      " Quantity consumed cannot exceed the available feed stock."}
  </small>
</div>
        </div>

        <div className="afc-section-header">
          <FiFileText />
          <h3>ADDITIONAL INFORMATION</h3>
          <div className="afc-line"></div>
        </div>

        <div className="afc-form-group afc-full-width">
          <label>Notes</label>

          <textarea
            rows="6"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            placeholder="Enter notes about this consumption..."
            maxLength={255}
          />

          <small>
            {form.notes.length} / 255
          </small>
        </div>

        <div className="afc-form-actions">
          <button
            type="button"
            className="afc-cancel-btn"
            onClick={() =>
              navigate("/inventory/feed-consumption")
            }
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving || exceedsStock}
            className="afc-save-btn"
          >
            <FiSave />
            Save Record
          </button>
        </div>
      </form>
    </PageLayout>
  );
}