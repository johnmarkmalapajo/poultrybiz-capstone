import { phToday } from "../phDate";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiSave, FiX, FiPackage, FiFileText } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./AddManureRecord.css";
import { createManureRecord } from "../api/wasteManure";
import { listFlocks } from "../api/flockProfile";
import { listHealthOptions } from "../api/healthOptions";
import { useUser } from "../hooks/useUser";
import { useLanguage } from "../i18n/LanguageContext";

const NEW_VALUE = "__new__";
const METHOD_OPTIONS = ["Composting", "Drying", "Biogas", "Direct Application"];
const END_USE_OPTIONS = ["Used as fertilizer", "Sold", "Composted", "Biogas"];

const todayStr = () => {
  return phToday();
};

export default function AddManureRecord() {
  const { t: tr } = useLanguage();
  const navigate = useNavigate();
  const { user } = useUser();

  const [formData, setFormData] = useState({
    date: todayStr(),
    batchId: "",
    quantityCollected: "",
    methodOfHandling: "",
    storageLocation: "",
    endUse: "",
    remarks: "",
  });

  const [newMethodOfHandling, setNewMethodOfHandling] = useState("");
  const [newEndUse, setNewEndUse] = useState("");
  const [methodOptions, setMethodOptions] = useState(METHOD_OPTIONS);
  const [endUseOptions, setEndUseOptions] = useState(END_USE_OPTIONS);

  const [flocks, setFlocks] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listFlocks()
      .then((d) => setFlocks(Array.isArray(d) ? d : d.records || d.flocks || []))
      .catch(() => setFlocks([]));
    listHealthOptions("manureMethod").then((r) => {
      const fetched = (r.options || []).map((o) => o.value);
      setMethodOptions([...METHOD_OPTIONS, ...fetched.filter((v) => !METHOD_OPTIONS.includes(v))]);
    }).catch(() => setMethodOptions(METHOD_OPTIONS));
    listHealthOptions("manureEndUse").then((r) => {
      const fetched = (r.options || []).map((o) => o.value);
      setEndUseOptions([...END_USE_OPTIONS, ...fetched.filter((v) => !END_USE_OPTIONS.includes(v))]);
    }).catch(() => setEndUseOptions(END_USE_OPTIONS));
  }, []);

  const batchOptions = [...new Set(
    flocks.filter((f) => f.status !== "Culled").map((f) => f.batchId).filter(Boolean)
  )];

  const personResponsible = user?.name || user?.fullName || "";

  const handleChange = (e) => {
    const { name } = e.target;
    let value = e.target.value;
    // iOS date pickers ignore the `max` attribute, so enforce it here too.
    const futureBlocked = e.target.type === "date" && e.target.max && value > e.target.max;
    if (futureBlocked) value = e.target.max;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(futureBlocked ? tr("Date cannot be a future date.") : "");
  };
  const [saving, setSaving] = useState(false);

  // Whole numbers only -- rejects anything that isn't plain digits (so
  // "-5", "1.5", "1e5" never get through), instead of parsing then clamping.
  const handleQuantityChange = (e) => {
    const { name, value } = e.target;
    if (value !== "" && !/^\d+$/.test(value)) return;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };
  const handleQuantityPaste = (e) => {
    const text = e.clipboardData.getData("text");
    if (!/^\d+$/.test(text)) e.preventDefault();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!/^\d+$/.test(String(formData.quantityCollected))) {
      setError(tr("Quantity of Manure Collected must be a whole number (no negative numbers or decimals)."));
      return;
    }
    if (formData.date && formData.date > todayStr()) {
      setError(tr("Date cannot be a future date."));
      return;
    }
    if (formData.methodOfHandling === NEW_VALUE && !newMethodOfHandling.trim()) {
      setError(tr("Please enter the new Method of Handling."));
      return;
    }
    if (formData.endUse === NEW_VALUE && !newEndUse.trim()) {
      setError(tr("Please enter the new End Use / Disposal."));
      return;
    }
    if (window.__pbSaving) return;
    window.__pbSaving = true;
    setSaving(true);
    try {
      const payload = {
        ...formData,
        personResponsible,
        recordType: "Manure",
        ...(formData.methodOfHandling === NEW_VALUE
          ? { methodOfHandling: undefined, newMethodOfHandling: newMethodOfHandling.trim() }
          : {}),
        ...(formData.endUse === NEW_VALUE
          ? { endUse: undefined, newEndUse: newEndUse.trim() }
          : {}),
      };
      await createManureRecord(payload);
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch {}
      navigate("/records/manure");
    } catch (err) {
      setError(tr(err?.message || "Couldn't save this record. Please try again."));
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
        { label: "MANURE AND WASTE RECORD", path: "/records/manure" },
        { label: "ADD MANURE" },
      ]}
    >

        <form className="amn-form-card" onSubmit={handleSubmit}>

          {error && (
            <div className="pb-error-banner">
              {error}
            </div>
          )}

          <div className="amn-section-header">
            <FiPackage />
            <h3>{tr("Manure Details")}</h3>
            <div className="amn-line" />
          </div>

          <div className="amn-form-grid">
            <div className="amn-form-group">
              <label>{tr("Date")}{" "}<span className="amn-req">*</span></label>
              <input type="date" name="date" value={formData.date} onChange={handleChange} max={todayStr()} required />
            </div>

            <div className="amn-form-group">
              <label>{tr("Batch ID / House No.")}{" "}<span className="amn-req">*</span></label>
              <select name="batchId" value={formData.batchId} onChange={handleChange} required>
                <option value="">{tr("Select batch / house")}</option>
                {batchOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>

            <div className="amn-form-group">
              <label>{tr("Quantity of Manure Collected")}{" "}<span className="amn-req">*</span></label>
              <div className="amn-input-unit">
                <input type="text" inputMode="numeric" name="quantityCollected" value={formData.quantityCollected}
                  onChange={handleQuantityChange} onPaste={handleQuantityPaste}
                  onKeyDown={(e) => ["-", "+", "e", "E", "."].includes(e.key) && e.preventDefault()}
                  placeholder={tr("Enter quantity")} required />
                <span className="amn-unit">{tr("kg")}</span>
              </div>
            </div>

            <div className="amn-form-group">
              <label>{tr("Method of Handling")}{" "}<span className="amn-req">*</span></label>
              <div style={{ display: "flex", gap: "10px" }}>
                <select name="methodOfHandling" value={formData.methodOfHandling} onChange={handleChange} style={{ flex: 1 }} required>
                  <option value="">{tr("Select method")}</option>
                  {methodOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  <option value={NEW_VALUE}>{tr("Others")}</option>
                </select>
                {formData.methodOfHandling === NEW_VALUE && (
                  <input
                    type="text"
                    value={newMethodOfHandling}
                    onChange={(e) => setNewMethodOfHandling(e.target.value)}
                    placeholder={tr("Enter method...")}
                    style={{ flex: 1 }}
                    required
                  />
                )}
              </div>
            </div>

            <div className="amn-form-group">
              <label>{tr("Storage Location")}{" "}<span className="amn-req">*</span></label>
              <input type="text" name="storageLocation" value={formData.storageLocation}
                onChange={handleChange} placeholder={tr("Enter storage location")} required />
            </div>

            <div className="amn-form-group">
              <label>{tr("End Use / Disposal")}{" "}<span className="amn-req">*</span></label>
              <div style={{ display: "flex", gap: "10px" }}>
                <select name="endUse" value={formData.endUse} onChange={handleChange} style={{ flex: 1 }} required>
                  <option value="">{tr("Select end use / disposal")}</option>
                  {endUseOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  <option value={NEW_VALUE}>{tr("Others")}</option>
                </select>
                {formData.endUse === NEW_VALUE && (
                  <input
                    type="text"
                    value={newEndUse}
                    onChange={(e) => setNewEndUse(e.target.value)}
                    placeholder={tr("Enter end use / disposal...")}
                    style={{ flex: 1 }}
                    required
                  />
                )}
              </div>
            </div>

            <div className="amn-form-group">
              <label>{tr("Person Responsible")}</label>
              <input type="text" value={personResponsible} disabled />
            </div>
          </div>

          <div className="amn-section-header">
            <FiFileText />
            <h3>{tr("Additional Information")}</h3>
            <div className="amn-line" />
          </div>

          <div className="amn-form-group amn-full-width">
            <label>{tr("Remarks")}</label>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange}
              placeholder={tr("Enter any remarks (optional)...")} maxLength={255} />
            <small className="amn-char-count">{formData.remarks.length} / 255</small>
          </div>

          <div className="amn-form-actions">
            <p className="amn-req-note">{tr("Fields with * are required.")}</p>
            <div className="amn-action-btns">
              <button type="button" className="amn-cancel-btn" onClick={() => navigate("/records/manure")}>
                <FiX />{" "}{tr("Cancel")}</button>
              <button type="submit" disabled={saving} className="amn-save-btn">
                <FiSave />{" "}{tr("Save Record")}</button>
            </div>
          </div>

        </form>

    </PageLayout>
  );
}