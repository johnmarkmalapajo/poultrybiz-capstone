import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiUser, FiMapPin, FiBriefcase, FiPhone,
  FiCheckCircle, FiXCircle, FiX, FiEye,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./ViewVisitor.css";

const API_BASE = `${import.meta.env?.VITE_API_URL || "http://localhost:5000"}/api/visitors`;

/* ── Inline mock ── */
const VISITORS = [
  { _id: "v1", fullName: "Dr. Ramon Cruz",  address: "Brgy. Poras, Boac, Marinduque", affiliation: "Provincial Veterinary Office", contactNumber: "0917 555 1201" },
  { _id: "v2", fullName: "Liza Mendoza",    address: "Brgy. Balimbing, Mogpog",       affiliation: "AgriFeeds Supplier Inc.",      contactNumber: "0928 555 3345" },
  { _id: "v3", fullName: "Engr. Paolo Lim", address: "Sta. Cruz, Marinduque",          affiliation: "DA Region IV-B",               contactNumber: "0939 555 8890" },
  { _id: "v4", fullName: "Carla Reyes",     address: "Brgy. Tabigue, Gasan",           affiliation: "PoultryVet Diagnostics",       contactNumber: "0916 555 7723" },
  { _id: "v5", fullName: "Mateo Santos",    address: "Brgy. Ipil, Boac",               affiliation: "Independent Buyer",            contactNumber: "0905 555 4412" },
];

// Visitor Logs per visitor (one log → one biosecurity assessment)
const LOGS_BY_ID = {
  v1: [
    { _id: "l1", date: "Jun 29, 2026", purpose: "Routine flock health inspection", plate: "ABC 1234", timeIn: "08:15 AM", timeOut: "10:40 AM" },
    { _id: "l2", date: "Jun 12, 2026", purpose: "Vaccination supervision",          plate: "ABC 1234", timeIn: "09:00 AM", timeOut: "11:20 AM" },
    { _id: "l3", date: "May 30, 2026", purpose: "Disease surveillance visit",        plate: "ABC 1234", timeIn: "07:50 AM", timeOut: "09:30 AM" },
  ],
  v2: [
    { _id: "l1", date: "Jun 27, 2026", purpose: "Feed delivery & sampling", plate: "TRK 8890", timeIn: "01:10 PM", timeOut: "02:00 PM" },
    { _id: "l2", date: "Jun 05, 2026", purpose: "Feed delivery",            plate: "TRK 8890", timeIn: "11:30 AM", timeOut: "12:05 PM" },
  ],
  v3: [
    { _id: "l1", date: "Jun 22, 2026", purpose: "DA compliance audit", plate: "GOV 0451", timeIn: "10:00 AM", timeOut: "12:30 PM" },
  ],
  v4: [
    { _id: "l1", date: "Jun 18, 2026", purpose: "Lab sample collection", plate: "VAN 5567", timeIn: "08:40 AM", timeOut: "09:25 AM" },
  ],
};

// Biosecurity assessment per LOG id (keyed visitorId:logId)
const BIO_BY_LOG = {
  "v1:l1": { footbath: "Yes", ppe: "Yes", disinfection: "Yes", otherFarm7d: "No",  otherFarmName: "", poultry48h: "No",  cleanClothes: "Yes", entryDisinfection: "Yes", fluSymptoms: "No" },
  "v1:l2": { footbath: "Yes", ppe: "Yes", disinfection: "Yes", otherFarm7d: "Yes", otherFarmName: "Sta. Cruz Layer Farm", poultry48h: "Yes", cleanClothes: "Yes", entryDisinfection: "Yes", fluSymptoms: "No" },
  "v1:l3": { footbath: "Yes", ppe: "No",  disinfection: "Yes", otherFarm7d: "No",  otherFarmName: "", poultry48h: "No",  cleanClothes: "Yes", entryDisinfection: "Yes", fluSymptoms: "No" },
  "v2:l1": { footbath: "Yes", ppe: "Yes", disinfection: "Yes", otherFarm7d: "Yes", otherFarmName: "Mogpog Broiler Co.", poultry48h: "No", cleanClothes: "Yes", entryDisinfection: "Yes", fluSymptoms: "No" },
  "v2:l2": { footbath: "Yes", ppe: "Yes", disinfection: "No",  otherFarm7d: "No",  otherFarmName: "", poultry48h: "No",  cleanClothes: "Yes", entryDisinfection: "No",  fluSymptoms: "No" },
  "v3:l1": { footbath: "Yes", ppe: "Yes", disinfection: "Yes", otherFarm7d: "No",  otherFarmName: "", poultry48h: "No",  cleanClothes: "Yes", entryDisinfection: "Yes", fluSymptoms: "No" },
  "v4:l1": { footbath: "Yes", ppe: "Yes", disinfection: "Yes", otherFarm7d: "Yes", otherFarmName: "Gasan Free-range Farm", poultry48h: "Yes", cleanClothes: "No", entryDisinfection: "Yes", fluSymptoms: "Yes" },
};

const getVisitorById = (id) => VISITORS.find((v) => v._id === id) || null;
const getLogsById = (id) => LOGS_BY_ID[id] || [];
const getBio = (vid, lid) => BIO_BY_LOG[`${vid}:${lid}`] || null;

const getName = (r) => r?.fullName || r?.name || "—";
const getAddress = (r) => r?.address || "—";
const getAffiliation = (r) => r?.affiliation || r?.company || r?.organization || "—";
const getContact = (r) => r?.contactNumber || r?.contact || "—";

// Biosecurity question labels in display order
const BIO_FIELDS = [
  ["footbath", "Footbath Used"],
  ["ppe", "PPE / Boots Provided"],
  ["disinfection", "Disinfection Done"],
  ["otherFarm7d", "Visited Another Farm (Last 7 Days)"],
  ["otherFarmName", "Farm Name / Location"],
  ["poultry48h", "Contact w/ Poultry/Livestock (Last 48 Hrs)"],
  ["cleanClothes", "Wearing Clean Clothes & Footwear"],
  ["entryDisinfection", "Used Footbath / Disinfection on Entry"],
  ["fluSymptoms", "Experienced Flu-like Symptoms Recently"],
];

export default function ViewVisitor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [visitor, setVisitor] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bioLog, setBioLog] = useState(null); // log whose biosecurity modal is open

  useEffect(() => {
    const token = localStorage.getItem("token") || "";
    const headers = { Authorization: `Bearer ${token}` };
    const mockVisitor = getVisitorById(id);
    const mockLogs = getLogsById(id);

    fetch(`${API_BASE}/${id}`, { headers })
      .then((r) => r.json())
      .then((d) => { const rec = d && (d.record || d.data || d); setVisitor(rec && (rec._id || rec.fullName) ? rec : mockVisitor); })
      .catch(() => setVisitor(mockVisitor))
      .finally(() => setLoading(false));

    fetch(`${API_BASE}/${id}/logs`, { headers })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : d.records || d.data || [];
        setLogs(list.length ? list : mockLogs);
      })
      .catch(() => { setLogs(mockLogs); });
  }, [id]);

  const yesNo = (v) => {
    const yes = String(v).toLowerCase() === "yes";
    return (
      <span className={`vv-badge ${yes ? "yes" : "no"}`}>
        {yes ? <FiCheckCircle /> : <FiXCircle />} {yes ? "Yes" : "No"}
      </span>
    );
  };

  const currentBio = bioLog ? getBio(id, bioLog._id || bioLog.id) : null;

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "PERSONNEL AND VISITORS", path: "/personnel-visitors" },
        { label: "VISITORS", path: "/personnel-visitors/visitors" },
        { label: "VIEW VISITOR" },
      ]}
    >
        {/* Visitor Information card */}
        <div className="vv-profile-card">
          <div className="vv-profile-body">
            <h1>{loading ? "Loading..." : getName(visitor)}</h1>
            <div className="vv-profile-grid">
              <div><p><FiMapPin /> Address</p><h4>{getAddress(visitor)}</h4></div>
              <div><p><FiBriefcase /> Affiliation / Company</p><h4>{getAffiliation(visitor)}</h4></div>
              <div><p><FiPhone /> Contact Number</p><h4>{getContact(visitor)}</h4></div>
              <div><p><FiUser /> Total Visits</p><h4>{logs.length}</h4></div>
            </div>
          </div>
        </div>

        {/* Section label */}
        <div className="vv-section-title">Visitor Logs</div>

        {/* Visitor Logs table */}
        <div className="vv-table-wrapper">
            <table className="vv-table">
              <thead>
                <tr>
                  <th>Date of Visit</th>
                  <th>Purpose of Visit</th>
                  <th>Vehicle Plate</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan="4" className="vv-empty">No visit logs for this visitor.</td></tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l._id || l.id}>
                      <td>{l.date || "—"}</td>
                      <td>{l.purpose || "—"}</td>
                      <td>{l.plate || l.vehiclePlate || "—"}</td>
                      <td>
                        <button
                          className="vv-icon-btn"
                          title="View biosecurity assessment"
                          onClick={() => setBioLog(l)}
                        >
                          <FiEye />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          <div className="vv-table-footer">Showing {logs.length} visit logs</div>
        </div>

      {/* ── BIOSECURITY MODAL (opens from the View button) ── */}
      {bioLog && (
        <div className="vv-bio-overlay" onClick={() => setBioLog(null)}>
          <div className="vv-bio-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vv-bio-modal-head">
              <div>
                <h3>Biosecurity Assessment</h3>
                <p>{bioLog.date} · {bioLog.purpose}</p>
              </div>
              <button className="vv-bio-close" onClick={() => setBioLog(null)} aria-label="Close"><FiX /></button>
            </div>

            {!currentBio ? (
              <div className="vv-empty" style={{ padding: "32px" }}>No biosecurity assessment for this visit.</div>
            ) : (
              <div className="vv-bio-grid">
                {BIO_FIELDS.map(([key, label]) => {
                  if (key === "otherFarmName" && String(currentBio.otherFarm7d).toLowerCase() !== "yes") return null;
                  return (
                    <div className="vv-bio-row" key={key}>
                      <span className="vv-bio-q">{label}</span>
                      {key === "otherFarmName"
                        ? <span className="vv-bio-text">{currentBio.otherFarmName || "—"}</span>
                        : yesNo(currentBio[key])}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </PageLayout>
  );
}