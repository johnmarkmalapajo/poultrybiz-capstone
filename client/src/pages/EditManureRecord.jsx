import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiSave, FiX, FiPackage, FiFileText } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./EditManureRecord.css";
import { getManureRecord, updateManureRecord } from "../api/wasteManure";
import { listHealthOptions } from "../api/healthOptions";
import { useUser } from "../hooks/useUser";

const NEW_VALUE = "__new__";
const METHOD_OPTIONS = ["Composting", "Drying", "Biogas", "Direct Application"];
const END_USE_OPTIONS = ["Used as fertilizer", "Sold", "Composted", "Biogas"];

const todayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export default function EditManureRecord() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    date: "",
    batchId: "",
    quantityCollected: "",
    methodOfHandling: "",
    storageLocation: "",
    endUse: "",
    personResponsible: "",
    remarks: "",
  });

  const [newMethodOfHandling, setNewMethodOfHandling] = useState("");
  const [newEndUse, setNewEndUse] = useState("");
  const [methodOptions, setMethodOptions] = useState(METHOD_OPTIONS);
  const [endUseOptions, setEndUseOptions] = useState(END_USE_OPTIONS);

  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const json = await getManureRecord(id);
        const rec = json.record || json.data || json;
        setFormData((prev) => ({ ...prev, ...rec }));
      } catch (err) {
        setError(err?.message || "Couldn't load this record.");
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
    listHealthOptions("manureMethod").then((r) => {
      const fetched = (r.options || []).map((o) => o.value);
      setMethodOptions([...METHOD_OPTIONS, ...fetched.filter((v) => !METHOD_OPTIONS.includes(v))]);
    }).catch(() => setMethodOptions(METHOD_OPTIONS));
    listHealthOptions("manureEndUse").then((r) => {
      const fetched = (r.options || []).map((o) => o.value);
      setEndUseOptions([...END_USE_OPTIONS, ...fetched.filter((v) => !END_USE_OPTIONS.includes(v))]);
    }).catch(() => setEndUseOptions(END_USE_OPTIONS));
  }, [id]);

  const personResponsible = user?.name || user?.fullName || formData.personResponsible || "";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (formData.date && String(formData.date).slice(0, 10) > todayStr()) {
      setError("Date cannot be a future date.");
      return;
    }
    if (formData.methodOfHandling === NEW_VALUE && !newMethodOfHandling.trim()) {
      setError("Please enter the new Method of Handling.");
      return;
    }
    if (formData.endUse === NEW_VALUE && !newEndUse.trim()) {
      setError("Please enter the new End Use / Disposal.");
      return;
    }
    try {
      setSaving(true);
      await updateManureRecord(id, {
        ...formData,
        personResponsible,
        ...(formData.methodOfHandling === NEW_VALUE
          ? { methodOfHandling: undefined, newMethodOfHandling: newMethodOfHandling.trim() }
          : {}),
        ...(formData.endUse === NEW_VALUE
          ? { endUse: undefined, newEndUse: newEndUse.trim() }
          : {}),
      });
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch {}
      navigate("/records/manure");
    } catch (err) {
      setSaving(false);
      setError(err?.message || "Couldn't save changes. Please try again.");
    }
  };

  if (loading) {
    return (
      <PageLayout
        background="#f4f4f2"
        breadcrumbItems={[
          { label: "RECORDS", path: "/records" },
          { label: "MANURE AND WASTE RECORD", path: "/records/manure" },
          { label: "EDIT MANURE" },
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
        { label: "MANURE AND WASTE RECORD", path: "/records/manure" },
        { label: "EDIT MANURE" },
      ]}
    >

        <form className="emn-form-card" onSubmit={handleSubmit}>

          {error && (
            <div className="pb-error-banner">
              {error}
            </div>
          )}

          <div className="emn-section-header">
            <FiPackage />
            <h3>Manure Details</h3>
            <div className="emn-line" />
          </div>

          <div className="emn-form-grid">
            <div className="emn-form-group">
              <label>Date <span className="emn-req">*</span></label>
              <input type="date" name="date"
                value={formData.date ? String(formData.date).slice(0, 10) : ""}
                onChange={handleChange} max={todayStr()} required />
            </div>

            <div className="emn-form-group">
              <label>Batch ID / House No. <span className="emn-req">*</span></label>
              <select name="batchId" value={formData.batchId} onChange={handleChange} required>
                <option value="">Select batch / house</option>
                {formData.batchId && <option value={formData.batchId}>{formData.batchId}</option>}
              </select>
            </div>

            <div className="emn-form-group">
              <label>Quantity of Manure Collected <span className="emn-req">*</span></label>
              <div className="emn-input-unit">
                <input type="number" min="0" name="quantityCollected" value={formData.quantityCollected}
                  onChange={handleChange} placeholder="Enter quantity" required />
                <span className="emn-unit">kg</span>
              </div>
            </div>

            <div className="emn-form-group">
              <label>Method of Handling <span className="emn-req">*</span></label>
              <div style={{ display: "flex", gap: "10px" }}>
                <select name="methodOfHandling" value={formData.methodOfHandling} onChange={handleChange} style={{ flex: 1 }} required>
                  <option value="">Select method</option>
                  {formData.methodOfHandling && formData.methodOfHandling !== NEW_VALUE && !methodOptions.includes(formData.methodOfHandling) && (
                    <option value={formData.methodOfHandling}>{formData.methodOfHandling}</option>
                  )}
                  {methodOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  <option value={NEW_VALUE}>Others</option>
                </select>
                {formData.methodOfHandling === NEW_VALUE && (
                  <input
                    type="text"
                    value={newMethodOfHandling}
                    onChange={(e) => setNewMethodOfHandling(e.target.value)}
                    placeholder="Enter method..."
                    style={{ flex: 1 }}
                    required
                  />
                )}
              </div>
            </div>

            <div className="emn-form-group">
              <label>Storage Location <span className="emn-req">*</span></label>
              <input type="text" name="storageLocation" value={formData.storageLocation}
                onChange={handleChange} placeholder="Enter storage location" required />
            </div>

            <div className="emn-form-group">
              <label>End Use / Disposal <span className="emn-req">*</span></label>
              <div style={{ display: "flex", gap: "10px" }}>
                <select name="endUse" value={formData.endUse} onChange={handleChange} style={{ flex: 1 }} required>
                  <option value="">Select end use / disposal</option>
                  {formData.endUse && formData.endUse !== NEW_VALUE && !endUseOptions.includes(formData.endUse) && (
                    <option value={formData.endUse}>{formData.endUse}</option>
                  )}
                  {endUseOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  <option value={NEW_VALUE}>Others</option>
                </select>
                {formData.endUse === NEW_VALUE && (
                  <input
                    type="text"
                    value={newEndUse}
                    onChange={(e) => setNewEndUse(e.target.value)}
                    placeholder="Enter end use / disposal..."
                    style={{ flex: 1 }}
                    required
                  />
                )}
              </div>
            </div>

            <div className="emn-form-group">
              <label>Person Responsible</label>
              <input type="text" value={personResponsible} disabled />
            </div>
          </div>

          <div className="emn-section-header">
            <FiFileText />
            <h3>Additional Information</h3>
            <div className="emn-line" />
          </div>

          <div className="emn-form-group emn-full-width">
            <label>Remarks</label>
            <textarea name="remarks" value={formData.remarks || ""} onChange={handleChange}
              placeholder="Enter any remarks (optional)..." maxLength={255} />
            <small className="emn-char-count">{(formData.remarks || "").length} / 255</small>
          </div>

          <div className="emn-form-actions">
            <p className="emn-req-note">Fields with * are required.</p>
            <div className="emn-action-btns">
              <button type="button" className="emn-cancel-btn" onClick={() => navigate("/records/manure")}>
                <FiX /> Cancel
              </button>
              <button type="submit" disabled={saving} className="emn-save-btn">
                <FiSave /> Update Record
              </button>
            </div>
          </div>

        </form>

    </PageLayout>
  );
}