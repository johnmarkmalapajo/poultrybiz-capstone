import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiInfo, FiFileText, FiSave } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditFeedInventory.css";
import {
  getFeedInventory,
  updateFeedInventory,
} from "../api/feedInventory";

const FEED_TYPES = ["Grower Feed", "Layer Feed"];
const QUANTITY_UNITS = ["sacks", "kg"];
const FEED_SACK_WEIGHT_KG = 50;

export default function EditFeedInventory() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [form, setForm] = useState({
    date: "",
    feedType: "",
    quantity: "",
    quantityUnit: "sacks",
    notes: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expenseRecordId, setExpenseRecordId] = useState(null);

  const isLinked = Boolean(expenseRecordId);

  useEffect(() => {
    const fetchRecord = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const json = await getFeedInventory(id);
        const record = json.record || json.data || json;

        const storedUnit = String(
          record.quantityUnit || record.unit || "sacks"
        ).toLowerCase();

        const quantityUnit =
          storedUnit === "kg" || storedUnit === "kilogram"
            ? "kg"
            : "sacks";

        let quantity = record.quantity;

        if (quantity === undefined || quantity === null || quantity === "") {
          const quantityIn = Number(record.quantityIn || 0);

          quantity =
            quantityUnit === "kg"
              ? quantityIn * FEED_SACK_WEIGHT_KG
              : quantityIn;
        }

        setForm({
          date: record.date
            ? new Date(record.date).toISOString().split("T")[0]
            : "",
          feedType: record.feedType || "",
          quantity,
          quantityUnit,
          notes: record.notes || "",
        });

        setExpenseRecordId(record.expenseRecordId || null);
      } catch (err) {
        setError(
          err?.message || "Couldn't load this feed inventory record."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [id]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "quantity") {
      if (value === "") {
        setForm((current) => ({
          ...current,
          quantity: "",
        }));
        return;
      }

      const numericValue = Number(value);

      if (Number.isNaN(numericValue)) {
        return;
      }

      setForm((current) => ({
        ...current,
        quantity:
          current.quantityUnit === "sacks"
            ? Math.max(0, Math.floor(numericValue))
            : Math.max(0, numericValue),
      }));

      return;
    }

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleUnitChange = (event) => {
    const unit = event.target.value;

    setForm((current) => ({
      ...current,
      quantityUnit: unit,
    }));
  };

  const quantity = Number(form.quantity || 0);

  const equivalentKg =
    form.quantityUnit === "sacks"
      ? quantity * FEED_SACK_WEIGHT_KG
      : quantity;

  const quantityIn =
    form.quantityUnit === "sacks" ? quantity : quantity / FEED_SACK_WEIGHT_KG;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving || window.__pbSaving) {
      return;
    }

    setError("");

    if (!isLinked) {
      if (!form.date) {
        setError("Please select the purchase date.");
        return;
      }

      if (!form.feedType) {
        setError("Please select a feed type.");
        return;
      }

      if (form.quantity === "" || quantity <= 0) {
        setError("Please enter a valid quantity.");
        return;
      }

      if (form.quantityUnit === "sacks" && !Number.isInteger(quantity)) {
        setError("Sack quantity must be a whole number.");
        return;
      }
    }

    window.__pbSaving = true;
    setSaving(true);

    try {
      const payload = isLinked
        ? {
            notes: form.notes.trim(),
          }
        : {
            date: form.date,
            feedType: form.feedType,
            quantity,
            quantityUnit: form.quantityUnit,
            quantityIn,
            equivalentKg,
            notes: form.notes.trim(),
          };

      await updateFeedInventory(id, payload);

      try {
        window.dispatchEvent(new Event("pb_data_changed"));
      } catch {}

      navigate("/inventory/feed-inventory");
    } catch (err) {
      setError(
        err?.message || "Couldn't update this feed inventory record."
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
            label: "FEED INVENTORY",
            path: "/inventory/feed-inventory",
          },
          {
            label: "EDIT FEED INVENTORY",
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
          label: "FEED INVENTORY",
          path: "/inventory/feed-inventory",
        },
        {
          label: "EDIT FEED INVENTORY",
        },
      ]}
    >
      <form
        className="efi-form-card"
        onSubmit={handleSubmit}
      >
        {error && (
          <div className="pb-error-banner">
            {error}
          </div>
        )}

        <div className="efi-section-header">
          <FiInfo />
          <h3>FEED PURCHASE DETAILS</h3>
          <div className="efi-line"></div>
        </div>

        <div className="efi-form-grid">
          <div className="efi-form-group">
            <label>
              Date Purchased{" "}
              <span className="efi-req">*</span>
            </label>

            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              disabled={isLinked}
              readOnly={isLinked}
              required
            />
          </div>

          <div className="efi-form-group">
            <label>
              Feed Type{" "}
              <span className="efi-req">*</span>
            </label>

            <select
              name="feedType"
              value={form.feedType}
              onChange={handleChange}
              disabled={isLinked}
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

          <div className="efi-form-group">
            <label>
              Quantity{" "}
              <span className="efi-req">*</span>
            </label>

            <div className="efi-quantity-input">
              <input
                type="number"
                min="0"
                step={
                  form.quantityUnit === "sacks"
                    ? "1"
                    : "0.01"
                }
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                placeholder="Enter quantity"
                disabled={isLinked}
                readOnly={isLinked}
                required
              />

              <select
                name="quantityUnit"
                value={form.quantityUnit}
                onChange={handleUnitChange}
                disabled={isLinked}
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

        <div className="efi-section-header">
          <FiFileText />
          <h3>ADDITIONAL INFORMATION</h3>
          <div className="efi-line"></div>
        </div>

        <div className="efi-form-group efi-full-width">
          <label>Remarks</label>

          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            placeholder="Enter remarks about this feed purchase..."
            maxLength={255}
          />

          <small className="efi-char-count">
            {form.notes.length} / 255
          </small>
        </div>

        <div className="efi-form-actions">
          <button
            type="button"
            className="efi-cancel-btn"
            onClick={() =>
              navigate(
                "/inventory/feed-inventory"
              )
            }
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="efi-save-btn"
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