import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiInfo,
  FiPackage,
  FiSave,
  FiX,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { getFlock, updateFlock } from "../api/flockProfile";
import { listBreeds } from "../api/breed";
import { listSuppliers } from "../api/supplier";
import "./EditFlock.css";
import { useLanguage } from "../i18n/LanguageContext";

const NEW_VALUE = "__new__";

const HARDCODED_BREEDS = ["Hy-Line W-36", "Lohmann LSL Lite", "Dekalb White", "Shaver White", "Hendrix White"];

const mergeBreeds = (dynamic) => {
  const merged = [...HARDCODED_BREEDS];
  (dynamic || []).forEach((name) => {
    if (!merged.some((b) => b.toLowerCase() === name.toLowerCase())) merged.push(name);
  });
  return merged;
};

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const FLOCK_ARRIVAL_AGE_WEEKS = 16;

function computeAgeWeeksPreview(dateStr) {
  if (!dateStr) return null;
  const start = new Date(dateStr);
  if (isNaN(start)) return null;
  const diffDays = Math.floor((new Date(localToday()) - new Date(dateStr)) / 86400000);
  return FLOCK_ARRIVAL_AGE_WEEKS + Math.max(0, Math.floor(diffDays / 7));
}

export default function EditFlock() {
  const { t: tr } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const today = localToday();

  const [formData, setFormData] = useState({
    batchId: "",
    breed: "",
    supplier: "",
    dateAcquired: "",
    dateAcquiredEnd: "",
    quantityPurchased: "",
    totalMortality: 0,
    status: "",
  });
  const [newBreed, setNewBreed] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [useDateRange, setUseDateRange] = useState(false);

  const [breeds, setBreeds] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    getFlock(id)
      .then((data) => {
        const rec = data.record || data.data || data;
        if (rec && (rec._id || rec.batchId)) {
          setFormData((prev) => ({
            ...prev,
            batchId: rec.batchId || "",
            breed: rec.breed || "",
            supplier: rec.supplier || "",
            dateAcquired: rec.dateAcquired ? String(rec.dateAcquired).slice(0, 10) : "",
            dateAcquiredEnd: rec.dateAcquiredEnd ? String(rec.dateAcquiredEnd).slice(0, 10) : "",
            quantityPurchased: rec.quantityPurchased ?? "",
            totalMortality:
              rec.totalMortality ??
              (rec.quantityPurchased != null && rec.currentQuantity != null
                ? Number(rec.quantityPurchased) - Number(rec.currentQuantity)
                : 0),
            status: rec.status || "",
          }));
          setUseDateRange(!!rec.dateAcquiredEnd);
        } else {
          setError(tr("Flock record not found."));
        }
      })
      .catch((err) => setError(tr(err?.message || "Couldn't load this flock record.")))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listBreeds()
      .then((d) => setBreeds(mergeBreeds((d.breeds || []).map((b) => b.name))))
      .catch(() => setBreeds(HARDCODED_BREEDS));
    listSuppliers()
      .then((d) => setSuppliers((d.suppliers || []).map((s) => s.name)))
      .catch(() => setSuppliers([]));
  }, []);

  const handleChange = (e) => {
    const { name } = e.target;
    let value = e.target.value;
    // iOS date pickers ignore the `max` attribute, so enforce it here too.
    const futureBlocked = e.target.type === "date" && e.target.max && value > e.target.max;
    if (futureBlocked) value = e.target.max;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(futureBlocked ? tr("Date cannot be a future date.") : "");
  };

  const purchaseQty    = Number(formData.quantityPurchased) || 0;
  const totalMortality = Number(formData.totalMortality) || 0;
  const currentBirds   = Math.max(0, purchaseQty - totalMortality);
  const mortalityRate  = purchaseQty > 0 ? ((totalMortality / purchaseQty) * 100).toFixed(2) : "0.00";
  const ageWeeksPreview = computeAgeWeeksPreview(formData.dateAcquired);

  const dateEndInvalid =
    useDateRange && formData.dateAcquiredEnd && formData.dateAcquired &&
    formData.dateAcquiredEnd < formData.dateAcquired;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (formData.breed === NEW_VALUE && !newBreed.trim()) {
      setError(tr("Please enter the new Breed name."));
      return;
    }
    if (formData.supplier === NEW_VALUE && !newSupplier.trim()) {
      setError(tr("Please enter the new Supplier name."));
      return;
    }
    if (!formData.dateAcquired) {
      setError(tr("Please select the Date Acquired."));
      return;
    }
    if (formData.dateAcquired > today) {
      setError(tr("Date Acquired cannot be a future date."));
      return;
    }
    if (useDateRange && formData.dateAcquiredEnd) {
      if (formData.dateAcquiredEnd > today) {
        setError(tr("Date Acquired (end) cannot be a future date."));
        return;
      }
      if (dateEndInvalid) {
        setError(tr("Date Acquired (end) cannot be earlier than the start date."));
        return;
      }
    }
    if (!/^\d+$/.test(String(formData.quantityPurchased).trim()) || Number(formData.quantityPurchased) <= 0) {
      setError(tr("Purchased Quantity must be a whole number greater than zero."));
      return;
    }

    const payload = {
      breed: formData.breed === NEW_VALUE ? undefined : formData.breed,
      newBreed: formData.breed === NEW_VALUE ? newBreed.trim() : undefined,
      supplier: formData.supplier === NEW_VALUE ? undefined : formData.supplier,
      newSupplier: formData.supplier === NEW_VALUE ? newSupplier.trim() : undefined,
      dateAcquired: formData.dateAcquired,
      dateAcquiredEnd: useDateRange && formData.dateAcquiredEnd ? formData.dateAcquiredEnd : null,
      quantityPurchased: Number(formData.quantityPurchased),
      currentQuantity: currentBirds,
      totalMortality,
    };

    if (window.__pbSaving) return;
    window.__pbSaving = true;
    setSaving(true);
    setError("");
    try {
      await updateFlock(id, payload);
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch {}
      navigate("/records/flock");
    } catch (err) {
      setError(tr(err?.message || "Couldn't save changes. Please try again."));
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
          { label: "RECORDS", path: "/records" },
          { label: "FLOCK PROFILE", path: "/records/flock" },
          { label: "EDIT FLOCK" },
        ]}
      >
        <p className="ef-loading">{tr("Loading flock record...")}</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        { label: "RECORDS", path: "/records" },
        { label: "FLOCK PROFILE", path: "/records/flock" },
        { label: "EDIT FLOCK" },
      ]}
    >
        <form className="ef-form-card" onSubmit={handleSubmit}>

          {error && (
            <div className="pb-error-banner">
              {error}
            </div>
          )}

          <div className="ef-section-header">
            <FiInfo />
            <h3>{tr("Batch Information")}</h3>
            <div className="ef-line" />
          </div>

          <div className="ef-form-grid">
            <div className="ef-form-group">
              <label>{tr("Batch ID")}</label>
              <input type="text" value={formData.batchId} disabled />
              <small>{tr("Batch ID cannot be changed after creation.")}</small>
            </div>

            <div className="ef-form-group">
              <label>{tr("Breed")}{" "}<span className="ef-req">*</span></label>
              <div className="ef-inline-flex">
                <select name="breed" value={formData.breed} onChange={handleChange} style={{ flex: 1 }} required>
                  <option value="">{tr("Select Breed")}</option>
                  {breeds.map((b) => <option key={b} value={b}>{b}</option>)}
                  {formData.breed && !breeds.includes(formData.breed) && formData.breed !== NEW_VALUE && (
                    <option value={formData.breed}>{formData.breed}</option>
                  )}
                  <option value={NEW_VALUE}>{tr("+ Add New Breed")}</option>
                </select>
                {formData.breed === NEW_VALUE && (
                  <input
                    type="text"
                    value={newBreed}
                    onChange={(e) => setNewBreed(e.target.value)}
                    placeholder={tr("Enter new breed name...")}
                    required
                  />
                )}
              </div>
              {formData.breed === NEW_VALUE && (
                <small>{tr("This will be saved and available in future Breed dropdowns.")}</small>
              )}
            </div>

            <div className="ef-form-group">
              <label>{tr("Supplier")}{" "}<span className="ef-req">*</span></label>
              <div className="ef-inline-flex">
                <select name="supplier" value={formData.supplier} onChange={handleChange} style={{ flex: 1 }} required>
                  <option value="">{tr("Select Supplier")}</option>
                  {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
                  {formData.supplier && !suppliers.includes(formData.supplier) && formData.supplier !== NEW_VALUE && (
                    <option value={formData.supplier}>{formData.supplier}</option>
                  )}
                  <option value={NEW_VALUE}>{tr("+ Add New Supplier")}</option>
                </select>
                {formData.supplier === NEW_VALUE && (
                  <input
                    type="text"
                    value={newSupplier}
                    onChange={(e) => setNewSupplier(e.target.value)}
                    placeholder={tr("Enter new supplier name...")}
                    required
                  />
                )}
              </div>
              {formData.supplier === NEW_VALUE && (
                <small>{tr("This will be saved and available in future Supplier dropdowns.")}</small>
              )}
            </div>

            <div className="ef-form-group">
              <label>{tr("Date Acquired")}{" "}<span className="ef-req">*</span></label>
              <input
                type="date"
                name="dateAcquired"
                value={formData.dateAcquired}
                onChange={handleChange}
                max={today}
                required
              />
            </div>

            <div className="ef-form-group">
              <label className="ef-checkbox-label">
                <input
                  type="checkbox"
                  checked={useDateRange}
                  onChange={(e) => setUseDateRange(e.target.checked)}
                />
                {" "}{tr("Acquired over a date range")}</label>
            </div>

            {useDateRange && (
              <div className="ef-form-group">
                <label>{tr("Date Acquired (End)")}{" "}<span className="ef-req">*</span></label>
                <input
                  type="date"
                  name="dateAcquiredEnd"
                  value={formData.dateAcquiredEnd}
                  onChange={handleChange}
                  min={formData.dateAcquired || undefined}
                  max={today}
                  required
                />
                {dateEndInvalid && <small style={{ color: "#c0392b" }}>{tr("Cannot be earlier than the start date.")}</small>}
              </div>
            )}
          </div>

          <div className="ef-section-header">
            <FiPackage />
            <h3>{tr("Bird Information")}</h3>
            <div className="ef-line" />
          </div>

          <div className="ef-form-grid">
            <div className="ef-form-group">
              <label>{tr("Purchased Quantity")}{" "}<span className="ef-req">*</span></label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                name="quantityPurchased"
                value={formData.quantityPurchased}
                onChange={(e) => {
                  // Whole numbers only: typed or stepped values that are not
                  // plain digits (decimals, negatives, "e") are ignored.
                  const v = e.target.value;
                  if (v !== "" && !/^\d+$/.test(v)) return;
                  setFormData((prev) => ({ ...prev, quantityPurchased: v }));
                  setError("");
                }}
                onKeyDown={(e) => ["-", "+", "e", "E", "."].includes(e.key) && e.preventDefault()}
                onPaste={(e) => {
                  if (!/^\d+$/.test(e.clipboardData.getData("text").trim())) e.preventDefault();
                }}
                placeholder={tr("Enter number of birds")}
                required
              />
            </div>

            <div className="ef-form-group">
              <label>{tr("Current Birds")}</label>
              <input type="text" value={currentBirds} disabled readOnly />
              <small>{tr("Purchased Qty − Total Mortality (")}{totalMortality}{" "}{tr("recorded)")}</small>
            </div>

            <div className="ef-form-group">
              <label>{tr("Mortality Rate")}</label>
              <input type="text" value={`${mortalityRate}%`} disabled readOnly />
              <small>{tr("(Total Mortality ÷ Purchased Qty) × 100")}</small>
            </div>

            <div className="ef-form-group">
              <label>{tr("Age")}</label>
              <input type="text" value={ageWeeksPreview !== null ? `${ageWeeksPreview} weeks` : "—"} disabled readOnly />
              <small>{tr("Auto-computed from Date Acquired.")}</small>
            </div>

            <div className="ef-form-group">
              <label>{tr("Status")}</label>
              <input type="text" value={formData.status || "—"} disabled readOnly />
              <small>{tr("Change status from the Flock Profile list.")}</small>
            </div>
          </div>

          <div className="ef-form-actions">
            <p className="ef-req-note">{tr("Fields with * are required.")}</p>
            <div className="ef-action-btns">
              <button type="button" className="ef-cancel-btn" onClick={() => navigate("/records/flock")}>
                <FiX />{" "}{tr("Cancel")}</button>
              <button type="submit" className="ef-save-btn" disabled={saving || dateEndInvalid}>
                <FiSave /> {saving ? "Saving..." : "Update Record"}
              </button>
            </div>
          </div>
        </form>
    </PageLayout>
  );
}