import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiSave,
  FiX,
  FiAlertCircle,
  FiFileText,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditQuarantineandIsolation.css";
import {
  getQuarantineRecord,
  updateQuarantineRecord,
} from "../api/quarantineIsolation";
import { listFlocks } from "../api/flockProfile";
import { listHealthOptions } from "../api/healthOptions";

const NEW_VALUE = "__new__";
const backRoute = "/records/quarantine?tab=isolation";

export default function EditQuarantineIsolation() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    batchId: "",
    dateIsolated: "",
    headCount: "",
    location: "",
    symptoms: "",
    remarks: "",
    isolationId: "",
    recovered: 0,
    deceased: 0,
    remaining: 0,
    dateCompleted: "",
    currentStatus: "",
  });
  const [newSymptom, setNewSymptom] = useState("");
  const [symptomOptions, setSymptomOptions] = useState([]);

  const [flocks, setFlocks] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listHealthOptions("symptom")
      .then((d) => setSymptomOptions((d.options || []).map((o) => o.value)))
      .catch(() => setSymptomOptions([]));
  }, []);

  useEffect(() => {
    listFlocks()
      .then((data) =>
        setFlocks(Array.isArray(data) ? data : data.records || data.flocks || [])
      )
      .catch(() => setFlocks([]));
  }, []);

  const batchOptions = [...new Set(flocks.filter((f) => f.status !== "Culled").map((f) => f.batchId).filter(Boolean))];
  const selectedFlock = flocks.find((f) => f.batchId === formData.batchId);
  const headCountExceedsAvailable =
    selectedFlock != null && Number(formData.headCount) > selectedFlock.currentQuantity;

  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const json = await getQuarantineRecord(id);
        const rec = json.record || json.data || json;
        setFormData((prev) => ({ ...prev, ...rec }));
      } catch (err) {
        setError(err?.message || "Couldn't load this record.");
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id]);

  const today = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  })();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBatchChange = (e) => {
    setFormData((prev) => ({ ...prev, batchId: e.target.value }));
  };

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
      setError(`Number of Birds Isolated cannot exceed the available birds in this batch (${selectedFlock.currentQuantity}).`);
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

    try {
      setSaving(true);
      setError("");
      await updateQuarantineRecord(id, payload);
      try {
        window.dispatchEvent(new Event("pb_data_changed"));
      } catch {}
      navigate(backRoute);
    } catch (err) {
      setSaving(false);
      setError(err?.message || "Couldn't save changes. Please try again.");
    }
  };

  const d = (v) => (v ? String(v).slice(0, 10) : "");

  if (loading) {
    return (
      <PageLayout
        background="#f4f4f2"
        breadcrumbItems={[
          { label: "RECORDS", path: "/records" },
          { label: "QUARANTINE AND ISOLATION", path: backRoute },
          { label: "EDIT ISOLATION RECORD" },
        ]}
      >
        <p className="pb-loading-text">Loading record...</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      background="#f4f4f2"
      breadcrumbItems={[
        { label: "RECORDS", path: "/records" },
        { label: "QUARANTINE AND ISOLATION", path: backRoute },
        { label: "EDIT ISOLATION RECORD" },
      ]}
    >
      <form className="eqi-form-card" onSubmit={handleSubmit}>
        {error && <div className="pb-error-banner">{error}</div>}

        <div className="eqi-section-header">
          <FiAlertCircle />
          <h3>Isolation Details</h3>
          <div className="eqi-line" />
        </div>

        <div className="eqi-form-grid">
          <div className="eqi-form-group">
            <label>Isolation ID</label>
            <input type="text" value={formData.isolationId} disabled />
            <small>Cannot be changed.</small>
          </div>

          <div className="eqi-form-group">
            <label>
              Batch ID <span className="eqi-req">*</span>
            </label>
            <select name="batchId" value={formData.batchId} onChange={handleBatchChange} required>
              <option value="">Select batch ID</option>
              {formData.batchId && !batchOptions.includes(formData.batchId) && (
                <option value={formData.batchId}>{formData.batchId}</option>
              )}
              {batchOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="eqi-form-group">
            <label>
              Date Isolated <span className="eqi-req">*</span>
            </label>
            <input
              type="date"
              name="dateIsolated"
              value={d(formData.dateIsolated)}
              onChange={handleChange}
              max={today}
              required
            />
          </div>

          <div className="eqi-form-group">
            <label>
              Number of Birds Isolated <span className="eqi-req">*</span>
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
              required
            />
            {selectedFlock && (
              <small style={headCountExceedsAvailable ? { color: "#c0392b" } : undefined}>
                Available birds in this batch: {selectedFlock.currentQuantity}
              </small>
            )}
          </div>

          <div className="eqi-form-group">
            <label>Location</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g. Isolation Pen 2"
            />
          </div>

          <div className="eqi-form-group">
            <label>
              Symptoms / Reasons <span className="eqi-req">*</span>
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
                {formData.symptoms && formData.symptoms !== NEW_VALUE && !symptomOptions.includes(formData.symptoms) && (
                  <option value={formData.symptoms}>{formData.symptoms}</option>
                )}
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

        <div className="eqi-section-header">
          <FiFileText />
          <h3>Remarks</h3>
          <div className="eqi-line" />
        </div>

        <div className="eqi-form-group eqi-full-width">
          <label>
            Remarks <span className="eqi-optional">(optional)</span>
          </label>
          <textarea
            name="remarks"
            value={formData.remarks || ""}
            onChange={handleChange}
            placeholder="Any additional notes about this isolation event..."
            maxLength={255}
          />
          <div className="eqi-char-row">
            <small>Optional remarks for this record.</small>
            <small className="eqi-char-count">
              {(formData.remarks || "").length} / 255
            </small>
          </div>
        </div>

        <div className="eqi-section-header">
          <FiAlertCircle />
          <h3>Isolation Progress (System-Managed)</h3>
          <div className="eqi-line" />
        </div>

        <div className="eqi-form-grid">
          <div className="eqi-form-group">
            <label>Recovered (total)</label>
            <input type="text" value={formData.recovered} disabled />
          </div>
          <div className="eqi-form-group">
            <label>Deceased (total)</label>
            <input type="text" value={formData.deceased} disabled />
          </div>
          <div className="eqi-form-group">
            <label>Remaining</label>
            <input type="text" value={formData.remaining} disabled />
          </div>
          <div className="eqi-form-group">
            <label>Status</label>
            <input type="text" value={formData.currentStatus || "—"} disabled />
          </div>
          {formData.dateCompleted && (
            <div className="eqi-form-group">
              <label>Date Completed</label>
              <input type="text" value={formData.dateCompleted} disabled />
            </div>
          )}
        </div>

        <div className="eqi-form-actions">
          <p className="eqi-req-note">Fields with * are required.</p>
          <div className="eqi-action-btns">
            <button type="button" className="eqi-cancel-btn" onClick={() => navigate(backRoute)}>
              <FiX /> Cancel
            </button>
            <button type="submit" disabled={saving || headCountExceedsAvailable} className="eqi-save-btn">
              <FiSave /> {saving ? "Saving..." : "Update Record"}
            </button>
          </div>
        </div>
      </form>
    </PageLayout>
  );
}