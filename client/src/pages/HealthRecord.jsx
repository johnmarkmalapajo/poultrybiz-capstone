import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload,
  FiEdit2, FiArchive, FiMenu, FiMaximize,
  FiActivity, FiAlertCircle, FiClipboard, FiDroplet,
} from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./HealthRecord.css";

const HEALTH_API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/health-records`;

export default function HealthRecord() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ batchId: "All", date: "All", category: "All" });
  const filterRef = useRef(null);
  const [activeTab, setActiveTab] = useState(
    params.get("tab") === "vaccination" ? "vaccination" : "diagnosis"
  );

  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(HEALTH_API)
      .then((r) => r.json())
      .then((d) => setAllRecords(Array.isArray(d) ? d : d.records || d.data || []))
      .catch(() => setAllRecords([]))
      .finally(() => setLoading(false));
  }, []);

  // A record is vaccination-type by its recordType or presence of a vaccine/drug field
  const isVaxRec = (r) =>
    ["Vaccination", "Medication", "Vitamin Administration"].includes(r.recordType) || r.vaccineOrDrug != null;
  const diagnosisRecords = allRecords.filter((r) => !isVaxRec(r));
  const vaccinationRecords = allRecords.filter(isVaxRec);

  const totalTreatments = diagnosisRecords.length;
  const totalVaccinations = vaccinationRecords.length;

  // close filter dropdown on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const isDiagnosis = activeTab === "diagnosis";

  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({ batchId: "All", date: "All", category: "All" });
  const activeFilterCount = Object.values(filters).filter((v) => v !== "All").length;

  // switching tabs resets the filter (fields differ per table)
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    clearFilters();
    setShowFilter(false);
  };

  const matchFilters = (r) => {
    const matchBatch = filters.batchId === "All" || r.batchId === filters.batchId;
    const matchDate  = filters.date === "All" || r.date === filters.date;
    const catField   = isDiagnosis ? r.vetDiagnosis : r.vaccineOrDrug;
    const matchCat   = filters.category === "All" || catField === filters.category;
    return matchBatch && matchDate && matchCat;
  };

  const filteredDiagnosis = diagnosisRecords.filter((r) =>
    (r.batchId?.toLowerCase().includes(search.toLowerCase()) ||
      r.vetDiagnosis?.toLowerCase().includes(search.toLowerCase()) ||
      r.presumptiveDiagnosis?.toLowerCase().includes(search.toLowerCase())) &&
    matchFilters(r)
  );

  const filteredVaccination = vaccinationRecords.filter((r) =>
    (r.batchId?.toLowerCase().includes(search.toLowerCase()) ||
      r.vaccineOrDrug?.toLowerCase().includes(search.toLowerCase())) &&
    matchFilters(r)
  );

  // -- Filter options derived from the ACTIVE tab's records --
  const activeSource = isDiagnosis ? diagnosisRecords : vaccinationRecords;
  const uniq = (vals) => [...new Set(vals.filter(Boolean))];
  const batchOptions = uniq(activeSource.map((r) => r.batchId));
  const dateOptions  = uniq(activeSource.map((r) => r.date));
  const categoryLabel = isDiagnosis ? "Diagnosis" : "Vaccine / Drug";
  const categoryOptions = uniq(
    activeSource.map((r) => (isDiagnosis ? r.vetDiagnosis : r.vaccineOrDrug))
  );

  const addLabel = isDiagnosis ? "Add Diagnosis Record" : "Add Medication/Vaccination Record";
  const addPath = isDiagnosis
    ? "/records/health/add?type=diagnosis"
    : "/records/health/add?type=vaccination";

  return (
    <div className="hr-page">
      <Sidebar />

      <div className="hr-main">

        {/* Breadcrumb */}
        <div className="hr-breadcrumb">
          <button className="hr-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="hr-bc-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span>›</span>
          <span className="hr-bc-current">HEALTH RECORD</span>
        </div>

        {/* Toolbar */}
        <div className="hr-toolbar">
          <button className="hr-add-btn" onClick={() => navigate(addPath)}>
            <FiPlus /> {addLabel}
          </button>
          <div className="hr-toolbar-right">
            <div className="hr-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder={isDiagnosis ? "Search diagnosis record..." : "Search treatment / vaccination record..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="hr-btn-group">
              <div className="hr-filter-wrap" ref={filterRef}>
                <button className="hr-toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="hr-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="hr-filter-dropdown">
                    <div className="hr-filter-dropdown-header">
                      <span>Filter {isDiagnosis ? "Diagnosis" : "Vaccination"} Records</span>
                      <button className="hr-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>

                    {/* Batch ID — select (both tabs) */}
                    <div className="hr-filter-group">
                      <label className="hr-filter-label">Batch ID</label>
                      <select
                        className="hr-filter-select"
                        value={filters.batchId}
                        onChange={(e) => handleFilterChange("batchId", e.target.value)}
                      >
                        <option value="All">All Batches</option>
                        {batchOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    {/* Tab-specific field — Diagnosis OR Vaccine / Drug */}
                    <div className="hr-filter-group">
                      <label className="hr-filter-label">{categoryLabel}</label>
                      <select
                        className="hr-filter-select"
                        value={filters.category}
                        onChange={(e) => handleFilterChange("category", e.target.value)}
                      >
                        <option value="All">All</option>
                        {categoryOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    {/* Date — chips (from active tab's records) */}
                    {dateOptions.length > 0 && (
                      <div className="hr-filter-group">
                        <label className="hr-filter-label">Date</label>
                        <div className="hr-filter-options">
                          <button
                            className={`hr-filter-option ${filters.date === "All" ? "selected" : ""}`}
                            onClick={() => handleFilterChange("date", "All")}
                          >All</button>
                          {dateOptions.map((opt) => (
                            <button
                              key={opt}
                              className={`hr-filter-option ${filters.date === opt ? "selected" : ""}`}
                              onClick={() => handleFilterChange("date", opt)}
                            >{opt}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button className="hr-toolbar-btn"><FiDownload /> Export</button>
            </div>
          </div>
        </div>

        {/* Active filter tags */}
        {activeFilterCount > 0 && (
          <div className="hr-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value !== "All" ? (
                <span key={key} className="hr-active-filter-tag">
                  {(key === "category" ? categoryLabel : key === "batchId" ? "Batch ID" : key.charAt(0).toUpperCase() + key.slice(1))}: {value}
                  <button onClick={() => handleFilterChange(key, "All")}>✕</button>
                </span>
              ) : null
            )}
          </div>
        )}

        {/* Stat Cards */}
        <div className="hr-stats-grid">
          <div className="hr-stat-card">
            <div className="hr-stat-icon gold"><FiClipboard /></div>
            <div>
              <h3>{totalTreatments}</h3>
              <p>Total Diagnosis Records</p>
              <span>All Time</span>
            </div>
          </div>
          <div className="hr-stat-card">
            <div className="hr-stat-icon green"><FiActivity /></div>
            <div>
              <h3>{totalVaccinations}</h3>
              <p>Total Vaccinations</p>
              <span>All Records</span>
            </div>
          </div>
          <div className="hr-stat-card">
            <div className="hr-stat-icon blue"><FiAlertCircle /></div>
            <div>
              <h3>—</h3>
              <p>Latest Diagnosis</p>
              <span>All Records</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="hr-tabs">
          <button
            className={`hr-tab ${activeTab === "diagnosis" ? "active" : ""}`}
            onClick={() => handleTabChange("diagnosis")}
          >
            <FiActivity /> Diagnosis Record
          </button>
          <button
            className={`hr-tab ${activeTab === "vaccination" ? "active" : ""}`}
            onClick={() => handleTabChange("vaccination")}
          >
            <FiDroplet /> Treatment / Vaccination Record
          </button>
        </div>

        {/* Table */}
        <div className="hr-table-wrapper">

          {activeTab === "diagnosis" && (
            <table className="hr-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>BATCH ID</th>
                  <th>CAGE</th>
                  <th>NUMBER OF BIRDS AFFECTED</th>
                  <th>DISEASE / OBSERVATION</th>
                  <th>PRESUMPTIVE DIAGNOSIS</th>
                  <th>VET DIAGNOSIS</th>
                  <th>TREATMENT APPLIED</th>
                  <th>NUMBER MORTALITY</th>
                  <th>NEXT SCHEDULE</th>
                  <th>REMARKS / FOLLOW-UP ACTION</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="12" className="hr-empty-state">Loading health records...</td></tr>
                ) : filteredDiagnosis.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="hr-empty-state">
                      <div className="hr-empty-content">
                        <FiMaximize />
                        <h3>No diagnosis records found</h3>
                        <p>Click Add Diagnosis Record to log your first diagnosis.</p>
                        <button className="hr-empty-add-btn" onClick={() => navigate("/records/health/add?type=diagnosis")}>
                          <FiPlus /> Add Diagnosis Record
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDiagnosis.map((r) => (
                    <tr key={r._id}>
                      <td>{r.date}</td>
                      <td><span className="hr-batch-badge">{r.batchId}</span></td>
                      <td>{r.cageId || "—"}</td>
                      <td className="hr-center">{r.numberOfBirdsAffected ?? "—"}</td>
                      <td>{r.symptomsObserved || "—"}</td>
                      <td>{r.presumptiveDiagnosis || "—"}</td>
                      <td>{r.vetDiagnosis}</td>
                      <td>{r.treatmentApplied}</td>
                      <td className="hr-center">{r.numberMortality}</td>
                      <td>{r.nextSchedule ? String(r.nextSchedule).slice(0, 10) : "—"}</td>
                      <td>{r.remarks}</td>
                      <td>
                        <div className="hr-actions">
                          <button
                            className="hr-btn-edit"
                            title="Edit"
                            onClick={() => navigate(`/records/health/edit/${r._id}?type=diagnosis`)}
                          >
                            <FiEdit2 />
                          </button>
                          <button className="hr-btn-archive" title="Archive">
                            <FiArchive />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === "vaccination" && (
            <table className="hr-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>BATCH ID</th>
                  <th>CAGE</th>
                  <th>NO. OF BIRDS ADMINISTERED</th>
                  <th>VACCINE / DRUG</th>
                  <th>TARGET AGE / STAGE</th>
                  <th>ROUTE</th>
                  <th>DOSAGE & FREQUENCY</th>
                  <th>ADMINISTERED BY</th>
                  <th>NEXT SCHEDULE</th>
                  <th>REMARKS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="12" className="hr-empty-state">Loading health records...</td></tr>
                ) : filteredVaccination.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="hr-empty-state">
                      <div className="hr-empty-content">
                        <FiMaximize />
                        <h3>No vaccination records found</h3>
                        <p>Click Add Medication/Vaccination Record to log your first vaccination.</p>
                        <button className="hr-empty-add-btn" onClick={() => navigate("/records/health/add?type=vaccination")}>
                          <FiPlus /> Add Medication/Vaccination Record
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredVaccination.map((r) => (
                    <tr key={r._id}>
                      <td>{r.date}</td>
                      <td><span className="hr-batch-badge">{r.batchId}</span></td>
                      <td>{r.cageId || "—"}</td>
                      <td className="hr-center">{r.numberOfBirdsAdministered ?? r.numberOfBirds ?? "—"}</td>
                      <td>{r.vaccineOrDrug}</td>
                      <td>{r.targetAge || "—"}</td>
                      <td>{r.routeOfAdmin}</td>
                      <td>{r.dosage}</td>
                      <td>{r.administeredBy}</td>
                      <td>{r.nextSchedule ? String(r.nextSchedule).slice(0, 10) : "—"}</td>
                      <td>{r.remarks}</td>
                      <td>
                        <div className="hr-actions">
                          <button
                            className="hr-btn-edit"
                            title="Edit"
                            onClick={() => navigate(`/records/health/edit/${r._id}?type=vaccination`)}
                          >
                            <FiEdit2 />
                          </button>
                          <button className="hr-btn-archive" title="Archive">
                            <FiArchive />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          <div className="hr-table-footer">
            Showing {activeTab === "diagnosis" ? filteredDiagnosis.length : filteredVaccination.length} entries
          </div>
        </div>

      </div>
    </div>
  );
}