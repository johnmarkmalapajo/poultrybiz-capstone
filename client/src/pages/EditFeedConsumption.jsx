import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiInfo, FiFileText, FiSave } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditFeedConsumption.css";
import {
  getFeedConsumption,
  updateFeedConsumption,
} from "../api/feedConsumption";
import { listFlocks } from "../api/flockProfile";

const FEED_TYPES = ["Grower Feed", "Layer Feed"];
const QUANTITY_UNITS = ["sacks", "kg"];
const FEED_SACK_WEIGHT_KG = 50;

function getFeedPlan(week) {
  if (week == null || isNaN(week) || week < 17) return null;

  if (week === 17) {
    return {
      grower: 100,
      layer: 0,
      gPerHead: 75,
    };
  }

  if (week === 18) {
    return {
      grower: 100,
      layer: 0,
      gPerHead: 85,
    };
  }

  if (week === 19) {
    return {
      grower: 75,
      layer: 25,
      gPerHead: 90,
    };
  }

  if (week === 20) {
    return {
      grower: 50,
      layer: 50,
      gPerHead: 95,
    };
  }

  if (week === 21) {
    return {
      grower: 25,
      layer: 75,
      gPerHead: 100,
    };
  }

  if (week === 22) {
    return {
      grower: 0,
      layer: 100,
      gPerHead: 105,
    };
  }

  return {
    grower: 0,
    layer: 100,
    gPerHead: 110,
  };
}

function planLabel(plan) {
  if (!plan) return "";

  const parts = [];

  if (plan.grower) {
    parts.push(`${plan.grower}% Grower Feed`);
  }

  if (plan.layer) {
    parts.push(`${plan.layer}% Layer Feed`);
  }

  return `${parts.join(" + ")} (${plan.gPerHead} g/head/day)`;
}

function primaryFeed(plan) {
  if (!plan) return "";

  return plan.layer > plan.grower
    ? "Layer Feed"
    : "Grower Feed";
}

function getAgeWeeks(flock) {
  if (!flock) return null;

  const direct =
    flock.currentAgeWeeks ??
    flock.ageWeeks ??
    flock.currentAge ??
    flock.ageInWeeks ??
    flock.age;

  if (direct != null && direct !== "") {
    return Math.floor(Number(direct));
  }

  const start =
    flock.dateAcquired ||
    flock.startDate ||
    flock.hatchDate ||
    flock.dateOfArrival ||
    flock.acquisitionDate;

  if (start) {
    const ms =
      Date.now() - new Date(start).getTime();

    if (!isNaN(ms)) {
      return Math.max(
        0,
        Math.floor(
          ms / (7 * 24 * 60 * 60 * 1000)
        )
      );
    }
  }

  return null;
}

function getQuantity(flock) {
  if (!flock) return null;

  const quantity =
    flock.currentQuantity ??
    flock.currentBirds ??
    flock.quantity ??
    flock.headCount ??
    flock.quantityPurchased ??
    flock.numberOfBirds ??
    flock.birdCount;

  const number = Number(quantity);

  return isNaN(number) || number <= 0
    ? null
    : number;
}

function computeConsumedKg(quantity, plan) {
  if (!quantity || !plan) return "";

  return String(
    Math.round(
      (quantity * plan.gPerHead / 1000) * 100
    ) / 100
  );
}

export default function EditFeedConsumption() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [batches, setBatches] = useState([]);
  const [flockList, setFlockList] = useState([]);
  const [autoMeta, setAutoMeta] = useState({});

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    date: "",
    batchId: "",
    feedType: "",
    quantityConsumed: "",
    quantityUnit: "kg",
    notes: "",
  });

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

          if (
            quantityUnit === "sacks" &&
            Number.isFinite(numericQuantity)
          ) {
            quantityConsumed =
              Math.floor(numericQuantity);
          }
        }

        setForm({
          date: record.date
            ? new Date(record.date)
                .toISOString()
                .split("T")[0]
            : "",
          batchId: record.batchId || "",
          feedType: record.feedType || "",
          quantityConsumed,
          quantityUnit,
          notes: record.notes || "",
        });
      } catch (err) {
        setError(
          err?.message ||
            "Couldn't load this record."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [id]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "quantityConsumed") {
      if (value === "") {
        setForm((current) => ({
          ...current,
          quantityConsumed: "",
        }));

        return;
      }

      const numericValue = Number(value);

      if (Number.isNaN(numericValue)) {
        return;
      }

      setForm((current) => ({
        ...current,
        quantityConsumed:
          current.quantityUnit === "sacks"
            ? Math.max(
                0,
                Math.floor(numericValue)
              )
            : Math.max(0, numericValue),
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

  const handleBatchChange = (event) => {
    const batchId = event.target.value;

    const flock = flockList.find(
      (item) => item.batchId === batchId
    );

    const age = getAgeWeeks(flock);
    const quantity = getQuantity(flock);
    const plan = getFeedPlan(age);

    setAutoMeta({
      currentAge: age,
      currentQuantity: quantity,
      feedTransition: planLabel(plan),
      gPerHeadPerDay:
        plan?.gPerHead ?? null,
    });

    setForm((current) => {
      const next = {
        ...current,
        batchId,
      };

      if (plan && quantity) {
        next.feedType = primaryFeed(plan);
        next.quantityConsumed =
          computeConsumedKg(quantity, plan);
        next.quantityUnit = "kg";
      }

      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving || window.__pbSaving) {
      return;
    }

    setError("");

    if (!form.date) {
      setError("Please select the date.");
      return;
    }

    if (!form.batchId) {
      setError("Please select a batch.");
      return;
    }

    if (!form.feedType) {
      setError("Please select a feed type.");
      return;
    }

    const quantity = Number(
      form.quantityConsumed || 0
    );

    if (
      form.quantityConsumed === "" ||
      quantity <= 0
    ) {
      setError(
        "Please enter a valid quantity consumed."
      );
      return;
    }

    if (
      form.quantityUnit === "sacks" &&
      !Number.isInteger(quantity)
    ) {
      setError(
        "Sack quantity must be a whole number."
      );
      return;
    }

    window.__pbSaving = true;
    setSaving(true);

    try {
      const equivalentKg =
        form.quantityUnit === "sacks"
          ? quantity * FEED_SACK_WEIGHT_KG
          : quantity;

      const payload = {
        date: form.date,
        batchId: form.batchId,
        feedType: form.feedType,
        quantityConsumed: quantity,
        quantityUnit: form.quantityUnit,
        equivalentKg,
        ...autoMeta,
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
        err?.message ||
          "Couldn't save changes. Please try again."
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
        <p className="pb-loading-text">
          Loading record...
        </p>
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
          <h3>CONSUMPTION DETAILS</h3>
          <div className="efc-line"></div>
        </div>

        <div className="efc-form-grid">
          <div className="efc-form-group">
            <label>
              Date{" "}
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
            <label>
              Batch ID{" "}
              <span className="efc-req">*</span>
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

              {batches.map((batchId) => (
                <option
                  key={batchId}
                  value={batchId}
                >
                  {batchId}
                </option>
              ))}
            </select>
          </div>

          <div className="efc-form-group">
            <label>
              Feed Type{" "}
              <span className="efc-req">*</span>
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
            <label>
              Quantity Consumed{" "}
              <span className="efc-req">*</span>
            </label>

            <div className="efc-quantity-input">
              <input
                type="number"
                min="0"
                step={
                  form.quantityUnit === "sacks"
                    ? "1"
                    : "0.01"
                }
                name="quantityConsumed"
                value={form.quantityConsumed}
                onChange={handleChange}
                placeholder="Enter quantity"
                required
              />

              <select
                name="quantityUnit"
                value={form.quantityUnit}
                onChange={
                  handleQuantityUnitChange
                }
                aria-label="Quantity unit"
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
                ? "1 sack = 50 kg"
                : "Quantity is recorded in kilograms."}
            </small>
          </div>
        </div>

        <div className="efc-section-header">
          <FiFileText />
          <h3>ADDITIONAL INFORMATION</h3>
          <div className="efc-line"></div>
        </div>

        <div className="efc-form-group efc-full-width">
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
            {(form.notes || "").length} / 255
          </small>
        </div>

        <div className="efc-form-actions">
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
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="efc-save-btn"
          >
            <FiSave />

            {saving
              ? "Updating..."
              : "Update Record"}
          </button>
        </div>
      </form>
    </PageLayout>
  );
}