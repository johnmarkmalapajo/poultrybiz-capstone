import { useState } from "react";
import { FiCheckCircle, FiUser, FiMapPin, FiBriefcase, FiPhone, FiCalendar, FiClipboard, FiTruck, FiShield } from "react-icons/fi";
import "./VisitorCheckIn.css";

const API_BASE = `${import.meta.env?.VITE_API_URL || "http://localhost:5000"}/api/visitors`;

const today = () => new Date().toISOString().slice(0, 10);

// Biosecurity questions (Yes/No)
const BIO_QUESTIONS = [
  ["footbath", "Did you use the footbath?"],
  ["ppe", "Were PPE / boots provided and worn?"],
  ["disinfection", "Was disinfection done?"],
  ["otherFarm7d", "Have you visited another farm within the last 7 days?"],
  // farm name shown only if otherFarm7d === Yes
  ["poultry48h", "Contact with poultry/livestock within the last 48 hours?"],
  ["cleanClothes", "Are you wearing clean clothes and footwear?"],
  ["entryDisinfection", "Used footbath / disinfection upon entry?"],
  ["fluSymptoms", "Experienced flu-like symptoms recently?"],
];

export default function VisitorCheckIn() {
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    // Visitor info
    fullName: "", address: "", affiliation: "", contactNumber: "",
    // Visit info
    dateOfVisit: today(), purpose: "", vehiclePlate: "",
    // Biosecurity
    footbath: "", ppe: "", disinfection: "", otherFarm7d: "", otherFarmName: "",
    poultry48h: "", cleanClothes: "", entryDisinfection: "", fluSymptoms: "",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    // Frontend only: the backend should search-or-create the Visitor, then create
    // a Visitor Log + Biosecurity Assessment linked by ObjectId references.
    const payload = {
      visitor: {
        fullName: form.fullName, address: form.address,
        affiliation: form.affiliation, contactNumber: form.contactNumber,
      },
      log: {
        dateOfVisit: form.dateOfVisit, purpose: form.purpose, vehiclePlate: form.vehiclePlate,
      },
      biosecurity: {
        footbath: form.footbath, ppe: form.ppe, disinfection: form.disinfection,
        otherFarm7d: form.otherFarm7d, otherFarmName: form.otherFarm7d === "Yes" ? form.otherFarmName : "",
        poultry48h: form.poultry48h, cleanClothes: form.cleanClothes,
        entryDisinfection: form.entryDisinfection, fluSymptoms: form.fluSymptoms,
      },
    };
    console.log("Visitor registration payload →", payload);
    // Example backend call (uncomment when API is ready):
    // fetch(`${API_BASE}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setDone(true);
  };

  // Yes/No radio group
  const YesNo = ({ name }) => (
    <div className="vc-radio-group">
      {["Yes", "No"].map((opt) => (
        <label key={opt} className={`vc-radio ${form[name] === opt ? "checked" : ""}`}>
          <input type="radio" name={name} value={opt} checked={form[name] === opt} onChange={() => set(name, opt)} required />
          {opt}
        </label>
      ))}
    </div>
  );

  if (done) {
    return (
      <div className="vc-page">
        <div className="vc-card">
          <div className="vc-success">
            <div className="vc-success-icon"><FiCheckCircle /></div>
            <h2>Registration Complete!</h2>
            <p className="vc-success-name">{form.fullName}</p>
            <p className="vc-success-meta">Your visit on {form.dateOfVisit} has been recorded. Thank you!</p>
            <button className="vc-btn vc-btn-ghost" onClick={() => { setForm({ ...form, purpose: "", vehiclePlate: "" }); setDone(false); }}>
              Register another visit
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vc-page">
      <form className="vc-card" onSubmit={submit}>
        {/* Brand */}
        <div className="vc-brand">
          <div className="vc-logo"><img src="/logo.png" alt="PoultryBiz" style={{ width: 40, height: 40, objectFit: "contain" }} /></div>
          <div><h1>PoultryBiz</h1><p>Visitor Registration</p></div>
        </div>

        {/* Visitor Information */}
        <div className="vc-section-head"><FiUser /> Visitor Information</div>
        <div className="vc-field">
          <label>Full Name <span className="req">*</span></label>
          <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Juan Dela Cruz" required />
        </div>
        <div className="vc-field">
          <label>Address <span className="req">*</span></label>
          <input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Brgy., Municipality, Province" required />
        </div>
        <div className="vc-field">
          <label>Affiliation / Company / Organization <span className="req">*</span></label>
          <input value={form.affiliation} onChange={(e) => set("affiliation", e.target.value)} placeholder="Company or organization" required />
        </div>
        <div className="vc-field">
          <label>Contact Number <span className="req">*</span></label>
          <input value={form.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} placeholder="0917 000 0000" required />
        </div>

        {/* Visit Information */}
        <div className="vc-section-head"><FiClipboard /> Visit Information</div>
        <div className="vc-field">
          <label><FiCalendar /> Date of Visit <span className="req">*</span></label>
          <input type="date" value={form.dateOfVisit} onChange={(e) => set("dateOfVisit", e.target.value)} required />
        </div>
        <div className="vc-field">
          <label>Purpose of Visit <span className="req">*</span></label>
          <input value={form.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="e.g., Flock inspection, Feed delivery" required />
        </div>
        <div className="vc-field">
          <label><FiTruck /> Vehicle Plate Number</label>
          <input value={form.vehiclePlate} onChange={(e) => set("vehiclePlate", e.target.value)} placeholder="ABC 1234 (if any)" />
        </div>

        {/* Biosecurity Questionnaire */}
        <div className="vc-section-head"><FiShield /> Biosecurity Questionnaire</div>
        {BIO_QUESTIONS.map(([key, q]) => (
          <div className="vc-question" key={key}>
            <span className="vc-q-text">{q} <span className="req">*</span></span>
            <YesNo name={key} />
            {key === "otherFarm7d" && form.otherFarm7d === "Yes" && (
              <div className="vc-field vc-subfield">
                <label>Farm Name / Location <span className="req">*</span></label>
                <input value={form.otherFarmName} onChange={(e) => set("otherFarmName", e.target.value)} placeholder="Name / location of the other farm" required />
              </div>
            )}
          </div>
        ))}

        <button className="vc-btn" type="submit"><FiCheckCircle /> Submit Registration</button>
        <p className="vc-hint">By submitting, your visit and biosecurity declaration are recorded for farm safety.</p>
      </form>
    </div>
  );
}
