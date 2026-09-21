import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  FiUser, FiMapPin, FiBriefcase, FiPhone,
  FiCheckCircle, FiXCircle, FiX, FiEye,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import "./ViewVisitor.css";
import { getVisitor, getVisitorLogs } from "../api/visitorLog";

const getName = (r) => r?.fullName || r?.name || "—";
const getAddress = (r) => r?.address || "—";
const getAffiliation = (r) => r?.affiliation || r?.company || r?.organization || "—";
const getContact = (r) => r?.contactNumber || r?.contact || "—";

// Biosecurity question labels in display order — the answers themselves
// live directly on each log entry (VisitorCheckIn.jsx submits visitor info,
// visit info, and biosecurity answers together as one check-in record).
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

  const [visitor, setVisitor] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bioLog, setBioLog] = useState(null); // log whose biosecurity modal is open

  useEffect(() => {
    setLoading(true);
    setError("");

    getVisitor(id)
      .then((d) => {
        const rec = d && (d.record || d.data || d);
        if (rec && (rec._id || rec.fullName)) setVisitor(rec);
        else setError("Visitor record not found.");
      })
      .catch((err) => setError(err?.message || "Couldn't load this visitor."))
      .finally(() => setLoading(false));

    getVisitorLogs(id)
      .then((d) => {
        const list = Array.isArray(d) ? d : d.records || d.data || [];
        setLogs(list);
      })
      .catch(() => setLogs([]));
  }, [id]);

  const yesNo = (v) => {
    const yes = String(v).toLowerCase() === "yes";
    return (
      <span className={`vv-badge ${yes ? "yes" : "no"}`}>
        {yes ? <FiCheckCircle /> : <FiXCircle />} {yes ? "Yes" : "No"}
      </span>
    );
  };

  // Biosecurity answers live directly on the log entry itself.
  const currentBio = bioLog?.biosecurity || bioLog || null;

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "PERSONNEL AND VISITORS", path: "/personnel-visitors" },
        { label: "VISITOR'S LOG", path: "/personnel-visitors/visitors" },
        { label: "VIEW VISITOR" },
      ]}
    >
        {error && (
          <div className="pb-error-banner">
            {error}
          </div>
        )}
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