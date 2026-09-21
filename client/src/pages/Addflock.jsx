import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiInfo,
  FiPackage,
  FiSave,
  FiX,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { listFlocks, createFlock } from "../api/flockProfile";
import { listBreeds, createBreed } from "../api/breed";
import { listSuppliers, createSupplier } from "../api/supplier";
import "./Addflock.css";

const NEW_VALUE = "__new__";
const FLOCK_ARRIVAL_AGE_WEEKS = 16;

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

function computeAgeWeeksPreview(dateStr) {
  if (!dateStr) return null;
  const start = new Date(dateStr);
  if (isNaN(start)) return null;
  const diffDays = Math.floor((new Date(localToday()) - new Date(dateStr)) / 86400000);
  return FLOCK_ARRIVAL_AGE_WEEKS + Math.max(0, Math.floor(diffDays / 7));
}

export default function AddFlock() {
  const navigate = useNavigate();
  const today = localToday();

  const [formData, setFormData] = useState({
    breed: "",
    supplier: "",
    dateAcquired: "",
    dateAcquiredEnd: "",
    quantityPurchased: "",
  });
  const [newBreed, setNewBreed] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [useDateRange, setUseDateRange] = useState(false);

  const [nextBatchId, setNextBatchId] = useState("F-001");
  const [breeds, setBreeds] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  useEffect(() => {
    listFlocks()
      .then((d) => {
        const batches = Array.isArray(d) ? d : d.records || d.data || d.flocks || [];
        let max = 0;
        batches.forEach((b) => {
          const m = /^F-(\d+)$/.exec(b.batchId || "");
          if (m) max = Math.max(max, parseInt(m[1], 10));
        });
        setNextBatchId(`F-${String(max + 1).padStart(3, "0")}`);
      })
      .catch(() => setNextBatchId("F-001"));
  }, []);

  useEffect(() => {
    listBreeds()
      .then((d) => setBreeds(mergeBreeds((d.breeds || []).map((b) => b.name))))
      .catch(() => setBreeds(HARDCODED_BREEDS));
    listSuppliers()
      .then((d) => setSuppliers((d.suppliers || []).map((s) => s.name)))
      .catch(() => setSuppliers([]));
  }, []);

  const ageWeeksPreview = computeAgeWeeksPreview(formData.dateAcquired);
  const statusPreview = formData.dateAcquired
    ? (formData.dateAcquired === today ? "Quarantined" : "Active")
    : null;

  const dateEndInvalid =
    useDateRange && formData.dateAcquiredEnd && formData.dateAcquired &&
    formData.dateAcquiredEnd < formData.dateAcquired;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (formData.breed === NEW_VALUE && !newBreed.trim()) {
      setError("Please enter the new Breed name.");
      return;
    }
    if (formData.supplier === NEW_VALUE && !newSupplier.trim()) {
      setError("Please enter the new Supplier name.");
      return;
    }
    if (!formData.dateAcquired) {
      setError("Please select the Date Acquired.");
      return;
    }
    if (formData.dateAcquired > today) {
      setError("Date Acquired cannot be a future date.");
      return;
    }
    if (useDateRange && formData.dateAcquiredEnd) {
      if (formData.dateAcquiredEnd > today) {
        setError("Date Acquired (end) cannot be a future date.");
        return;
      }
      if (dateEndInvalid) {
        setError("Date Acquired (end) cannot be earlier than the start date.");
        return;
      }
    }
    if (!/^\d+$/.test(String(formData.quantityPurchased).trim()) || Number(formData.quantityPurchased) <= 0) {
      setError("Purchased Quantity must be a whole number greater than zero.");
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
    };

    if (window.__pbSaving) return;
    window.__pbSaving = true;
    setSaving(true);
    setError("");
    try {
      await createFlock(payload);
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch {}
      navigate("/records/flock");
    } catch (err) {
      setError(err?.message || "Couldn't save this flock. Please try again.");
      setSaving(false);
    } finally {
      window.__pbSaving = false;
    }
  };

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        { label: "RECORDS", path: "/records" },
        { label: "FLOCK PROFILE", path: "/records/flock" },
        { label: "ADD NEW FLOCK" },
      ]}
    >
        <form className="af-form-card" onSubmit={handleSubmit}>

          {error && (
            <div className="pb-error-banner">
              {error}
            </div>
          )}

          <div className="af-section-header">
            <FiInfo />
            <h3>Batch Information</h3>
            <div className="af-line" />
          </div>

          <div className="af-form-grid">
            <div className="af-form-group">
              <label>Batch ID</label>
              <input type="text" value={nextBatchId} disabled />
              <small>Automatically generated when this record is saved.</small>
            </div>

            <div className="af-form-group">
              <label>Breed <span className="af-req">*</span></label>
              <div className="af-inline-flex">
                <select name="breed" value={formData.breed} onChange={handleChange} style={{ flex: 1 }} required>
                  <option value="">Select Breed</option>
                  {breeds.map((b) => <option key={b} value={b}>{b}</option>)}
                  <option value={NEW_VALUE}>+ Add New Breed</option>
                </select>
                {formData.breed === NEW_VALUE && (
                  <input
                    type="text"
                    value={newBreed}
                    onChange={(e) => setNewBreed(e.target.value)}
                    placeholder="Enter new breed name..."
                    required
                  />
                )}
              </div>
              {formData.breed === NEW_VALUE && (
                <small>This will be saved and available in future Breed dropdowns.</small>
              )}
            </div>

            <div className="af-form-group">
              <label>Supplier <span className="af-req">*</span></label>
              <div className="af-inline-flex">
                <select name="supplier" value={formData.supplier} onChange={handleChange} style={{ flex: 1 }} required>
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
                  <option value={NEW_VALUE}>+ Add New Supplier</option>
                </select>
                {formData.supplier === NEW_VALUE && (
                  <input
                    type="text"
                    value={newSupplier}
                    onChange={(e) => setNewSupplier(e.target.value)}
                    placeholder="Enter new supplier name..."
                    required
                  />
                )}
              </div>
              {formData.supplier === NEW_VALUE && (
                <small>This will be saved and available in future Supplier dropdowns.</small>
              )}
            </div>

            <div className="af-form-group">
              <label>Date Acquired <span className="af-req">*</span></label>
              <input
                type="date"
                name="dateAcquired"
                value={formData.dateAcquired}
                onChange={handleChange}
                max={today}
                required
              />
            </div>

            <div className="af-form-group">
              <label className="af-checkbox-label">
                <input
                  type="checkbox"
                  checked={useDateRange}
                  onChange={(e) => setUseDateRange(e.target.checked)}
                />
                {" "}Acquired over a date range
              </label>
            </div>

            {useDateRange && (
              <div className="af-form-group">
                <label>Date Acquired (End) <span className="af-req">*</span></label>
                <input
                  type="date"
                  name="dateAcquiredEnd"
                  value={formData.dateAcquiredEnd}
                  onChange={handleChange}
                  min={formData.dateAcquired || undefined}
                  max={today}
                  required
                />
                {dateEndInvalid && <small style={{ color: "#c0392b" }}>Cannot be earlier than the start date.</small>}
              </div>
            )}
          </div>

          <div className="af-section-header">
            <FiPackage />
            <h3>Bird Information</h3>
            <div className="af-line" />
          </div>

          <div className="af-form-grid">
            <div className="af-form-group">
              <label>Purchased Quantity <span className="af-req">*</span></label>
              <input
                type="text"
                inputMode="numeric"
                name="quantityPurchased"
                value={formData.quantityPurchased}
                onChange={(e) => setFormData((prev) => ({ ...prev, quantityPurchased: e.target.value.replace(/[^\d]/g, "") }))}
                placeholder="Enter number of birds"
                required
              />
            </div>

            <div className="af-form-group">
              <label>Current Birds</label>
              <input type="text" value={formData.quantityPurchased || "—"} disabled readOnly />
              <small>Purchased Qty − Total Mortality (0 recorded)</small>
            </div>

            <div className="af-form-group">
              <label>Age</label>
              <input type="text" value={ageWeeksPreview !== null ? `${ageWeeksPreview} weeks` : "—"} disabled readOnly />
              <small>Auto-computed from Date Acquired.</small>
            </div>

            <div className="af-form-group">
              <label>Status</label>
              <input type="text" value={statusPreview || "—"} disabled readOnly />
              <small>Flocks acquired today start Quarantined until released; flocks acquired on a past date start Active.</small>
            </div>
          </div>

          <div className="af-form-actions">
            <p className="af-req-note">Fields with * are required.</p>
            <div className="af-action-btns">
              <button type="button" className="af-cancel-btn" onClick={() => navigate("/records/flock")}>
                <FiX /> Cancel
              </button>
              <button type="submit" className="af-save-btn" disabled={saving || dateEndInvalid}>
                <FiSave /> {saving ? "Saving..." : "Save Record"}
              </button>
            </div>
          </div>
        </form>
    </PageLayout>
  );
}