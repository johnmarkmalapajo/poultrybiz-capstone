import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiSave,
  FiX,
  FiAlertCircle,
  FiFileText,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./AddQuarantineIsolation.css";
import { createQuarantineRecord, listQuarantineRecords } from "../api/quarantineIsolation";
import { listFlocks } from "../api/flockProfile";
import { listHealthOptions } from "../api/healthOptions";

const NEW_VALUE = "__new__";
const backRoute = "/records/quarantine?tab=isolation";

export default function AddQuarantineIsolation() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    batchId: "",
    dateIsolated: "",
    headCount: "",
    location: "",
    symptoms: "",
    remarks: "",
  });
  const [newSymptom, setNewSymptom] = useState("");

  const [flocks, setFlocks] = useState([]);
  const [symptomOptions, setSymptomOptions] = useState([]);
  const [nextIsolationId, setNextIsolationId] = useState("ISO-001");
  const [ongoingQuarantineBatches, setOngoingQuarantineBatches] = useState([]);

  useEffect(() => {
    listFlocks()
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : data.records || data.flocks || [];
        setFlocks(list);
      })
      .catch(() => setFlocks([]));
  }, []);

  useEffect(() => {
    listQuarantineRecords()
      .then((data) => {
        const all = Array.isArray(data) ? data : data.records || data.data || [];
        let max = 0;
        all.forEach((r) => {
          const m = /^ISO-(\d+)$/.exec(r.isolationId || "");
          if (m) max = Math.max(max, parseInt(m[1], 10));
        });
        setNextIsolationId(`ISO-${String(max + 1).padStart(3, "0")}`);

        setOngoingQuarantineBatches(
          all
            .filter((r) => r.recordType === "Quarantine" && r.status === "Ongoing")
            .map((r) => r.batchId)
        );
      })
      .catch(() => {
        setNextIsolationId("ISO-001");
        setOngoingQuarantineBatches([]);
      });
  }, []);

  useEffect(() => {
    listHealthOptions("symptom")
      .then((d) => setSymptomOptions((d.options || []).map((o) => o.value)))
      .catch(() => setSymptomOptions([]));
  }, []);

  const batchOptions = [
    ...new Set(
      flocks
        .filter((f) => f.status !== "Culled")
        .map((f) => f.batchId)
        .filter(Boolean)
        .filter((id) => !ongoingQuarantineBatches.includes(id))
    ),
  ];

  const today = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  })();
  const selectedFlock = flocks.find((f) => f.batchId === formData.batchId);
  const availableBirds = selectedFlock?.currentQuantity;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBatchChange = (e) => {
    setFormData((prev) => ({ ...prev, batchId: e.target.value }));
  };

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const headCountExceedsAvailable =
    availableBirds != null &&
    Number(formData.headCount) > availableBirds;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (formData.symptoms === NEW_VALUE && !newSymptom.trim()) {
      setError("Please enter the Symptoms/Reasons.");
      return;
    }
    if (formData.dateIsolated > today) {
      setError("Date Isolated cannot be in the future.");
      return;
    }
    if (!/^\d+$/.test(String(formData.headCount).trim()) || Number(formData.headCount) <= 0) {
      setError("Number of Birds Isolated must be a whole number greater than zero.");
      return;
    }
    if (headCountExceedsAvailable) {
      setError(`Number of Birds Isolated cannot exceed the available birds in this batch (${availableBirds}).`);
      return;
    }

    const payload = {
      batchId: formData.batchId,
      dateIsolated: formData.dateIsolated,
      headCount: formData.headCount,
      location: formData.location,
      remarks: formData.remarks,
      ...(formData.symptoms === NEW_VALUE
        ? { newSymptom: newSymptom.trim() }
        : { symptoms: formData.symptoms }),
    };

    if (window.__pbSaving) return;
    window.__pbSaving = true;
    setSaving(true);
    setError("");
    try {
      await createQuarantineRecord({ ...payload, recordType: "Isolation" });
      try {
        window.dispatchEvent(new Event("pb_data_changed"));
      } catch {}
      navigate(backRoute);
    } catch (err) {
      setError(err?.message || "Couldn't save this record. Please try again.");
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
        { label: "QUARANTINE AND ISOLATION", path: backRoute },
        { label: "ADD ISOLATION RECORD" },
      ]}
    >
      <form className="aqi-form-card" onSubmit={handleSubmit}>
        {error && <div className="pb-error-banner">{error}</div>}

        <div className="aqi-section-header">
          <FiAlertCircle />
          <h3>Isolation Details</h3>
          <div className="aqi-line" />
        </div>

        <div className="aqi-form-grid">
          <div className="aqi-form-group">
            <label>Isolation ID</label>
            <input type="text" value={nextIsolationId} disabled />
            <small>Automatically generated when this record is saved.</small>
          </div>

          <div className="aqi-form-group">
            <label>
              Batch ID <span className="aqi-req">*</span>
            </label>
            <select
              name="batchId"
              value={formData.batchId}
              onChange={handleBatchChange}
              required
            >
              <option value="">Select batch ID</option>
              {batchOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="aqi-form-group">
            <label>
              Date Isolated <span className="aqi-req">*</span>
            </label>
            <input
              type="date"
              name="dateIsolated"
              value={formData.dateIsolated}
              onChange={handleChange}
              max={today}
              required
            />
          </div>

          <div className="aqi-form-group">
            <label>
              Number of Birds Isolated <span className="aqi-req">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              name="headCount"
              value={formData.headCount}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  headCount: e.target.value.replace(/[^\d]/g, ""),
                }))
              }
              placeholder="Enter number of birds"
              required
            />
            {selectedFlock && (
              <small style={headCountExceedsAvailable ? { color: "#c0392b" } : undefined}>
                Available birds in this batch: {availableBirds}
              </small>
            )}
          </div>

          <div className="aqi-form-group">
            <label>Location</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g. Isolation Pen 2"
            />
          </div>

          <div className="aqi-form-group">
            <label>
              Symptoms / Reasons <span className="aqi-req">*</span>
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              <select
                name="symptoms"
                value={formData.symptoms}
                onChange={handleChange}
                style={{ flex: 1 }}
                required
              >
                <option value="">Select symptoms/reasons</option>
                {symptomOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value={NEW_VALUE}>Others</option>
              </select>
              {formData.symptoms === NEW_VALUE && (
                <input
                  type="text"
                  value={newSymptom}
                  onChange={(e) => setNewSymptom(e.target.value)}
                  placeholder="Enter symptoms/reason..."
                  style={{ flex: 1 }}
                  required
                />
              )}
            </div>
            <small>Shared with Diagnosis's Presumptive Diagnosis list. This will be saved and available in future Symptoms/Reasons and Presumptive Diagnosis dropdowns.</small>
          </div>
        </div>

        <div className="aqi-section-header">
          <FiFileText />
          <h3>Remarks</h3>
          <div className="aqi-line" />
        </div>

        <div className="aqi-form-group aqi-full-width">
          <label>
            Remarks <span className="aqi-optional">(optional)</span>
          </label>
          <textarea
            name="remarks"
            value={formData.remarks}
            onChange={handleChange}
            placeholder="Any additional notes about this isolation event..."
            maxLength={255}
          />
          <div className="aqi-char-row">
            <small>Optional remarks for this record.</small>
            <small className="aqi-char-count">
              {formData.remarks.length} / 255
            </small>
          </div>
        </div>

        <div className="aqi-form-actions">
          <p className="aqi-req-note">Fields with * are required.</p>
          <div className="aqi-action-btns">
            <button
              type="button"
              className="aqi-cancel-btn"
              onClick={() => navigate(backRoute)}
            >
              <FiX /> Cancel
            </button>
            <button type="submit" disabled={saving || headCountExceedsAvailable} className="aqi-save-btn">
              <FiSave /> {saving ? "Saving..." : "Save Record"}
            </button>
          </div>
        </div>
      </form>
    </PageLayout>
  );
}