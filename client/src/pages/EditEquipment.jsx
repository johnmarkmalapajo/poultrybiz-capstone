import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiInfo, FiPackage, FiMapPin, FiFileText, FiSave } from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { useUser } from "../hooks/useUser";
import "./EditEquipment.css";
import { getEquipment, updateEquipment } from "../api/equipmentTools";
import { listPersonnel } from "../api/personnelManpower";
import { listHealthOptions, createHealthOption } from "../api/healthOptions";
import "../components/ArchiveConfirmModal.css";
import { useLanguage } from "../i18n/LanguageContext";

const CONDITIONS = ["In Use", "Idle", "For Repair", "For Disposal"];
const UNITS = ["pcs", "units", "sets", "pairs", "kg", "liters"];

const blockInvalidNumberKeys = (e) => {
  if (["-", "+", "e", "E"].includes(e.key)) {
    e.preventDefault();
  }
};

const blockInvalidNumberPaste = (e) => {
  const text = e.clipboardData.getData("text");
  if (!/^\d*\.?\d*$/.test(text)) {
    e.preventDefault();
  }
};

const todayStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

const ADD_NEW_OPTION = "__new_option__";
const byName = (a, b) => a.localeCompare(b, "en", { sensitivity: "base" });

// Texts of the Equipment Location/Storage dropdown (the default use).
const LOCATION_TEXT = {
  name: "location",
  placeholder: "Select location/storage",
  addOption: "+ Add New Location/Storage",
  title: "Add New Location/Storage",
  fieldLabel: "Location/Storage Name",
  inputPlaceholder: "Enter location or storage area",
  required: "Location/Storage name is required.",
  duplicate: "This Location/Storage already exists.",
  saveError: "Couldn't save this location. Please try again.",
};

/**
 * Dropdown of a saved option list (server "health-options" category) with a
 * "+ Add New ..." entry. The new name is saved in the database right away,
 * then added to the dropdown and selected. Used for the Equipment
 * Location/Storage (Add / Edit Equipment, via LocationStorageSelect below)
 * and the Personnel Position (Edit Personnel), so every form that uses a
 * list always offers the same saved values on every device.
 *
 * `reserved` lists names that can't be added (checked ignoring case);
 * `text` overrides the labels and messages above.
 */
export function SavedOptionSelect({
  category = "equipmentLocation",
  value,
  onChange,
  text = LOCATION_TEXT,
  reserved = {},
  disabled = false,
  canAdd = true,
  id,
}) {
  const { t: tr } = useLanguage();
  const [saved, setSaved] = useState([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const L = { ...LOCATION_TEXT, ...text };

  useEffect(() => {
    let cancelled = false;
    listHealthOptions(category)
      .then((d) => {
        if (!cancelled) setSaved((d.options || []).map((o) => o.value).sort(byName));
      })
      .catch(() => { /* the saved value (below) still shows */ });
    return () => { cancelled = true; };
  }, [category]);

  // The record's saved value is always selectable, even before (or if)
  // the list loads.
  const options = value && !saved.some((l) => l.toLowerCase() === value.toLowerCase())
    ? [...saved, value].sort(byName)
    : saved;

  const openAdd = () => { setNewName(""); setAddError(""); setAdding(true); };
  const closeAdd = () => { if (!savingNew) setAdding(false); };

  const saveNew = async () => {
    if (savingNew) return;
    const name = newName.trim().replace(/\s+/g, " ");
    if (!name) { setAddError(tr(L.required)); return; }
    const reservedMsg = reserved[name.toLowerCase()];
    if (reservedMsg) { setAddError(tr(reservedMsg)); return; }
    if (options.some((l) => l.toLowerCase() === name.toLowerCase())) {
      setAddError(tr(L.duplicate));
      return;
    }
    setSavingNew(true); setAddError("");
    try {
      const res = await createHealthOption(category, name);
      const savedName = res?.option?.value || name;
      setSaved((list) => [...list, savedName].sort(byName));
      onChange(savedName);
      setAdding(false);
    } catch (err) {
      setAddError(tr(err?.message || L.saveError));
    } finally {
      setSavingNew(false);
    }
  };

  const inputId = `${id || L.name}-new-option`;

  return (
    <>
      <select
        id={id}
        name={L.name}
        value={value}
        onChange={(e) => (e.target.value === ADD_NEW_OPTION ? openAdd() : onChange(e.target.value))}
        required
        disabled={disabled}
      >
        <option value="">{tr(L.placeholder)}</option>
        {options.map((l) => <option key={l} value={l}>{l}</option>)}
        {canAdd && !disabled && <option value={ADD_NEW_OPTION}>{tr(L.addOption)}</option>}
      </select>

      {adding && (
        <div className="pb-confirm-overlay" onClick={closeAdd}>
          <div className="pb-confirm-modal eeq-loc-modal" role="dialog" aria-modal="true" aria-labelledby={`${inputId}-title`} onClick={(e) => e.stopPropagation()}>
            <h3 className="pb-confirm-title" id={`${inputId}-title`}>{tr(L.title)}</h3>
            <label className="eeq-loc-label" htmlFor={inputId}>
              {tr(L.fieldLabel)}{" "}<span className="eeq-req">*</span>
            </label>
            <input
              id={inputId}
              className="eeq-loc-input"
              type="text"
              value={newName}
              maxLength={100}
              autoFocus
              placeholder={tr(L.inputPlaceholder)}
              aria-required="true"
              aria-invalid={addError ? true : undefined}
              onChange={(e) => { setNewName(e.target.value); setAddError(""); }}
              onKeyDown={(e) => {
                // Inside the record's <form>: Enter saves the new option, it
                // must not submit the whole record.
                if (e.key === "Enter") { e.preventDefault(); saveNew(); }
                if (e.key === "Escape") closeAdd();
              }}
            />
            {addError && <span className="pb-field-error eeq-loc-error">{addError}</span>}
            <div className="pb-confirm-actions">
              <button type="button" className="pb-confirm-cancel" onClick={closeAdd} disabled={savingNew}>{tr("Cancel")}</button>
              <button type="button" className="pb-confirm-archive" onClick={saveNew} disabled={savingNew}>
                {savingNew ? tr("Saving...") : tr("Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Location/Storage dropdown shared by Add Equipment and Edit Equipment, so
 * both forms always offer the same saved locations (one source: the
 * server's "equipmentLocation" options, which also include every location
 * already used on an Equipment record).
 */
export function LocationStorageSelect({ value, onChange }) {
  return <SavedOptionSelect category="equipmentLocation" value={value} onChange={onChange} />;
}

// ── Custodian / Assigned To ─────────────────────────────────────────────

// Value of the option that keeps an older record's custodian, saved as a
// typed name before custodians were linked to Personnel records.
export const KEEP_UNLINKED_CUSTODIAN = "__keep_custodian__";

// Who can be given equipment: the same rule Personnel and Manpower uses for
// assigning tasks (record not archived, account Active), plus an Active
// Employment Status. The server checks the same rule when saving.
const isAssignablePersonnel = (p) =>
  Boolean(p && p.user && p.user.name) &&
  !p.archived && !p.user.archived &&
  p.status === "Active" &&
  (!p.user.status || p.user.status === "Active");

const CUSTODIAN_STATE_LABEL = {
  inactive: "Inactive",
  archived: "Archived",
  missing: "Record removed",
};

/**
 * Custodian / Assigned To dropdown shared by Add Equipment and Edit
 * Equipment. Its options are the Personnel and Manpower records (loaded
 * through the Personnel API -- no typed or fixed names); the value is the
 * Personnel record's id.
 *
 * `current` is the record's saved assignment (custodianInfo from the
 * Equipment API). If that person can no longer be assigned (inactive,
 * archived, removed) or the record only has an older typed name, it is
 * still shown and stays selected, so opening and saving the form never
 * replaces it -- the user can still pick someone else.
 */
export function CustodianSelect({ value, current = null, onChange, disabled = false, required = false, id }) {
  const { t: tr } = useLanguage();
  const [personnel, setPersonnel] = useState(null); // null while loading
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPersonnel()
      .then((json) => {
        if (cancelled) return;
        const list = Array.isArray(json) ? json : json.data || json.records || json.personnel || [];
        setPersonnel(list);
      })
      .catch(() => {
        if (!cancelled) { setPersonnel([]); setLoadFailed(true); }
      });
    return () => { cancelled = true; };
  }, []);

  const assignable = (personnel || [])
    .filter(isAssignablePersonnel)
    .map((p) => ({ value: String(p._id), name: p.user.name.trim(), position: p.position || "" }))
    .sort((a, b) => byName(a.name, b.name));
  // Two people with the same name are told apart by their position.
  const nameCount = assignable.reduce((m, o) => m.set(o.name.toLowerCase(), (m.get(o.name.toLowerCase()) || 0) + 1), new Map());
  const options = assignable.map((o) => ({
    value: o.value,
    label: nameCount.get(o.name.toLowerCase()) > 1 ? `${o.name} (${o.position || tr("No position")})` : o.name,
  }));

  // The saved assignment, when it isn't one of the options above.
  let kept = null;
  if (current?.personnelId && !options.some((o) => o.value === current.personnelId)) {
    const state = CUSTODIAN_STATE_LABEL[current.state];
    kept = { value: current.personnelId, label: state ? `${current.name} (${tr(state)})` : current.name };
  } else if (!current?.personnelId && current?.name) {
    kept = { value: KEEP_UNLINKED_CUSTODIAN, label: `${current.name} (${tr("not in Personnel records")})` };
  }

  const loading = personnel === null;
  const placeholder = loading
    ? tr("Loading personnel...")
    : options.length ? tr("Select personnel") : tr("No active personnel records");

  return (
    <>
      <select
        id={id}
        name="custodianPersonnel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {kept && <option value={kept.value}>{kept.label}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {loadFailed && <small>{tr("Couldn't load Personnel records. Please refresh the page.")}</small>}
      {!loadFailed && !loading && !options.length && !disabled && (
        <small>{tr("Add personnel in Personnel and Manpower first.")}</small>
      )}
      {kept && value === kept.value && current?.state !== "unlinked" && (
        <small>{tr("This person is no longer active. The assignment stays unless you choose someone else.")}</small>
      )}
    </>
  );
}

export default function EditEquipment() {
  const { t: tr } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const { canSeeFinancials, role } = useUser();
  const isOwner = role === "Owner";

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  // The saved Custodian / Assigned To (from the Equipment API) and the value
  // the dropdown started with, so an unchanged assignment is never re-sent.
  const [custodianInfo, setCustodianInfo] = useState(null);
  const initialCustodian = useRef("");
  const [error, setError] = useState("");
  const [expenseRecordId, setExpenseRecordId] = useState(null);
  const [form, setForm] = useState({
    name: "", description: "", serialNo: "",
    quantity: "", unit: "", condition: "",
    location: "", custodianPersonnel: "", dateAcquired: "",
    cost: "", remarks: "",
  });

  const isLinked = Boolean(expenseRecordId);

  useEffect(() => {
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const json = await getEquipment(id);
        const r = json.record || json.data || json;
        const info = r.custodianInfo || (r.custodian ? { personnelId: null, name: r.custodian, state: "unlinked" } : null);
        const custodianValue = info?.personnelId || (info?.name ? KEEP_UNLINKED_CUSTODIAN : "");
        initialCustodian.current = custodianValue;
        setCustodianInfo(info);
        setForm({
          name: r.name || "",
          description: r.description || "",
          serialNo: r.serialNo || "",
          quantity: r.quantity ?? "",
          unit: r.unit || "",
          condition: r.condition || "",
          location: r.location || "",
          custodianPersonnel: custodianValue,
          dateAcquired: r.dateAcquired || "",
          cost: r.cost ?? "",
          remarks: r.remarks || "",
        });
        setExpenseRecordId(r.expenseRecordId || null);
      } catch (err) {
        setError(tr(err?.message || "Couldn't load this record."));
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchRecord();
    else setLoading(false);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps


  const handleChange = (e) => {
    const { name } = e.target;
    let value = e.target.value;
    // iOS date pickers ignore `max`, so enforce it here and tell the user.
    if (e.target.type === "date" && e.target.max && value > e.target.max) {
      value = e.target.max;
      setForm((f) => ({ ...f, [name]: value }));
      setError(tr("Date cannot be a future date."));
      return;
    }
    setForm((f) => ({ ...f, [name]: value }));
    setError("");
  };

  // The Serial ID message is also shown right under its field.
  const serialError = error === tr("Serial ID is required.");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (window.__pbSaving) return;
    window.__pbSaving = true;
    setSaving(true); setError("");
    try {
      if (!form.serialNo.trim()) {
        throw new Error("Serial ID is required.");
      }

      if (
        !form.quantity ||
        Number.isNaN(Number(form.quantity)) ||
        Number(form.quantity) <= 0
      ) {
        throw new Error("Please enter a valid quantity.");
      }

      if (
        form.cost !== "" &&
        (Number.isNaN(Number(form.cost)) || Number(form.cost) < 0)
      ) {
        throw new Error("Please enter a valid acquisition cost.");
      }

      const { custodianPersonnel, ...fields } = form;
      const payload = { ...fields, serialNo: form.serialNo.trim() };
      // Only a changed Custodian is sent; otherwise the saved assignment is
      // kept exactly as it is.
      if (custodianPersonnel !== initialCustodian.current && custodianPersonnel !== KEEP_UNLINKED_CUSTODIAN) {
        payload.custodianPersonnel = custodianPersonnel || null;
      }
      await updateEquipment(id, payload);
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { }
      navigate("/inventory/equipment");
    } catch (err) {
      setError(tr(err?.message || "Couldn't save changes. Please try again."));
      if (err?.message === "Serial ID is required.") document.querySelector('[name="serialNo"]')?.focus();
      setSaving(false);
    } finally {
      window.__pbSaving = false;
    }
  };

  if (loading) {
    return (
      <PageLayout background="#f4f4f2" breadcrumbItems={[{ label: "INVENTORY", path: "/inventory" }, { label: "EQUIPMENT & TOOLS", path: "/inventory/equipment" }, { label: "EDIT EQUIPMENT" }]}>
        <p className="pb-loading-text">{tr("Loading record...")}</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout background="#f4f4f2" breadcrumbItems={[{ label: "INVENTORY", path: "/inventory" }, { label: "EQUIPMENT & TOOLS", path: "/inventory/equipment" }, { label: "EDIT EQUIPMENT" }]}>

        <form className="eeq-form-card" onSubmit={handleSubmit}>

          {error && (
            <div className="pb-error-banner">
              {error}
            </div>
          )}

          <div className="eeq-section-header">
            <FiInfo />
            <h3>{tr("EQUIPMENT DETAILS")}</h3>
            <div className="eeq-line"></div>
          </div>

          <div className="eeq-form-grid">
            <div className="eeq-form-group">
              <label>{tr("Equipment/Tool Name")}{" "}<span className="eeq-req">*</span></label>
              <input type="text" name="name" value={form.name} onChange={handleChange} placeholder={tr("Enter equipment/tool name")} disabled={isLinked} readOnly={isLinked} required />
            </div>

            <div className="eeq-form-group">
              <label>{tr("Serial/ID No.")}{" "}<span className="eeq-req">*</span></label>
              <input type="text" name="serialNo" value={form.serialNo} onChange={handleChange} placeholder={tr("Enter serial or ID number")} aria-required="true" aria-invalid={serialError || undefined} />
              {serialError && <span className="pb-field-error">{error}</span>}
            </div>

            <div className="eeq-form-group eeq-full-width">
              <label>{tr("Description/Specifications")}{" "}<span className="eeq-req">*</span></label>
              <textarea name="description" value={form.description} onChange={handleChange} rows="3" placeholder={tr("Enter description or specifications")} disabled={isLinked} readOnly={isLinked} required />
            </div>
          </div>

          <div className="eeq-section-header">
            <FiPackage />
            <h3>{tr("STOCK & CONDITION")}</h3>
            <div className="eeq-line"></div>
          </div>

          <div className="eeq-form-grid">
            <div className="eeq-form-group">
              <label>{tr("Quantity")}{" "}<span className="eeq-req">*</span></label>
              <input type="number" min="0" name="quantity" value={form.quantity} onChange={handleChange} onKeyDown={blockInvalidNumberKeys} onPaste={blockInvalidNumberPaste} placeholder={tr("Enter quantity")} disabled={isLinked} readOnly={isLinked} required />
            </div>

            <div className="eeq-form-group">
              <label>{tr("Unit")}{" "}<span className="eeq-req">*</span></label>
              <select name="unit" value={form.unit} onChange={handleChange} max={todayStr()} disabled={isLinked} required>
                <option value="">{tr("Select unit")}</option>
                {UNITS.map((u) => <option key={u} value={u}>{tr(u)}</option>)}
              </select>
            </div>

            <div className="eeq-form-group">
              <label>{tr("Condition")}{" "}<span className="eeq-req">*</span></label>
              <select name="condition" value={form.condition} onChange={handleChange} required>
                <option value="">{tr("Select condition")}</option>
                {CONDITIONS.map((c) => <option key={c} value={c}>{tr(c)}</option>)}
              </select>
            </div>
          </div>

          <div className="eeq-section-header">
            <FiMapPin />
            <h3>{tr("ASSIGNMENT & ACQUISITION")}</h3>
            <div className="eeq-line"></div>
          </div>

          <div className="eeq-form-grid">
            <div className="eeq-form-group">
              <label>{tr("Location/Storage")}{" "}<span className="eeq-req">*</span></label>
              <LocationStorageSelect value={form.location} onChange={(location) => setForm((f) => ({ ...f, location }))} />
            </div>

            <div className="eeq-form-group">
              <label htmlFor="eeq-custodian">{tr("Custodian/Assigned To")}{" "}{isOwner && <span className="eeq-req">*</span>}</label>
              <CustodianSelect
                id="eeq-custodian"
                value={form.custodianPersonnel}
                current={custodianInfo}
                onChange={(custodianPersonnel) => setForm((f) => ({ ...f, custodianPersonnel }))}
                required={isOwner}
                disabled={!isOwner}
              />
              {!isOwner && <small>{tr("Only the Owner can change the custodian.")}</small>}
            </div>

            {isOwner && (
              <div className="eeq-form-group">
                <label>{tr("Date Acquired")}{" "}<span className="eeq-req">*</span></label>
                <input type="date" name="dateAcquired" value={form.dateAcquired ? new Date(form.dateAcquired).toISOString().split("T")[0] : ""} onChange={handleChange} disabled={isLinked} readOnly={isLinked} required />
              </div>
            )}

            {canSeeFinancials && (
              <div className="eeq-form-group">
                <label>{tr("Acquisition Cost")}{" "}<span className="eeq-req">*</span></label>
                <div className="eeq-input-with-prefix">
                  <span className="eeq-prefix">₱</span>
                  <input type="number" min="0" step="0.01" name="cost" value={form.cost} onChange={handleChange} onKeyDown={blockInvalidNumberKeys} onPaste={blockInvalidNumberPaste} placeholder="0.00" disabled={isLinked} readOnly={isLinked} required />
                </div>
              </div>
            )}
          </div>

          <div className="eeq-section-header">
            <FiFileText />
            <h3>{tr("ADDITIONAL")}</h3>
            <div className="eeq-line"></div>
          </div>

          <div className="eeq-form-group eeq-full-width">
            <label>{tr("Remarks")}</label>
            <textarea name="remarks" value={form.remarks} onChange={handleChange} rows="4" placeholder={tr("Enter remarks (optional)")} maxLength={255} />
            <small>{(form.remarks || "").length} / 255</small>
          </div>

          <div className="eeq-form-actions">
            <button type="button" className="eeq-cancel-btn" onClick={() => navigate("/inventory/equipment")}>{tr("Cancel")}</button>
            <button type="submit" disabled={saving} className="eeq-save-btn">
              <FiSave />{tr("Update Record")}</button>
          </div>
        </form>

    </PageLayout>
  );
}