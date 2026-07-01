import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload,
  FiEdit2, FiArchive, FiMenu, FiMaximize, FiShield,
  FiClipboard, FiCheckCircle, FiHeart,
} from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./QuarantineandIsolation.css";

export default function QuarantineIsolation() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ status: "All", batchId: "All", date: "All" });
  const filterRef = useRef(null);

  const records = [];

  useEffect(() => {
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({ status: "All", batchId: "All", date: "All" });
  const activeFilterCount = Object.values(filters).filter((v) => v !== "All").length;

  const STATUS_OPTIONS = ["Isolate", "Recovered", "Deceased"];
  const uniq = (vals) => [...new Set(vals.filter(Boolean))];
  const batchOptions = uniq(records.map((r) => r.batchId));
  const dateOptions  = uniq(records.map((r) => r.dateStarted));

  const filtered = records.filter((r) =>
    (r.batchId?.toLowerCase().includes(search.toLowerCase()) ||
      r.reason?.toLowerCase().includes(search.toLowerCase()) ||
      r.status?.toLowerCase().includes(search.toLowerCase())) &&
    (filters.status === "All" || r.status === filters.status) &&
    (filters.batchId === "All" || r.batchId === filters.batchId) &&
    (filters.date === "All" || r.dateStarted === filters.date)
  );

  const statusClass = (status) => {
    if (!status) return "qi-status";
    const s = status.toLowerCase();
    if (s === "isolate")   return "qi-status qi-status-isolate";
    if (s === "recovered") return "qi-status qi-status-recovered";
    if (s === "deceased")  return "qi-status qi-status-deceased";
    return "qi-status";
  };

  const byStatus = (s) =>
    records.filter((r) => r.status?.toLowerCase() === s).length;
  const totalRecords = records.length;
  const inIsolation = byStatus("isolate");
  const recovered = byStatus("recovered");
  const deceased = byStatus("deceased");

  return (
    <div className="qi-page">
      <Sidebar />

      <div className="qi-main">

        {/* Breadcrumb */}
        <div className="qi-breadcrumb">
          <button className="qi-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="qi-bc-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span>›</span>
          <span className="qi-bc-current">QUARANTINE AND ISOLATION</span>
        </div>

        {/* Toolbar */}
        <div className="qi-toolbar">
          <button className="qi-add-btn" onClick={() => navigate("/records/quarantine/add")}>
            <FiPlus /> Add Record
          </button>
          <div className="qi-toolbar-right">
            <div className="qi-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search record..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="qi-btn-group">
              <div className="qi-filter-wrap" ref={filterRef}>
                <button className="qi-toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="qi-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="qi-filter-dropdown">
                    <div className="qi-filter-dropdown-header">
                      <span>Filter Records</span>
                      <button className="qi-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>

                    <div className="qi-filter-group">
                      <label className="qi-filter-label">Status</label>
                      <div className="qi-filter-options">
                        <button
                          className={`qi-filter-option ${filters.status === "All" ? "selected" : ""}`}
                          onClick={() => handleFilterChange("status", "All")}
                        >All</button>
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            className={`qi-filter-option ${filters.status === opt ? "selected" : ""}`}
                            onClick={() => handleFilterChange("status", opt)}
                          >{opt}</button>
                        ))}
                      </div>
                    </div>

                    <div className="qi-filter-group">
                      <label className="qi-filter-label">Batch ID</label>
                      <select
                        className="qi-filter-select"
                        value={filters.batchId}
                        onChange={(e) => handleFilterChange("batchId", e.target.value)}
                      >
                        <option value="All">All Batches</option>
                        {batchOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    {dateOptions.length > 0 && (
                      <div className="qi-filter-group">
                        <label className="qi-filter-label">Date Started</label>
                        <div className="qi-filter-options">
                          <button
                            className={`qi-filter-option ${filters.date === "All" ? "selected" : ""}`}
                            onClick={() => handleFilterChange("date", "All")}
                          >All</button>
                          {dateOptions.map((opt) => (
                            <button
                              key={opt}
                              className={`qi-filter-option ${filters.date === opt ? "selected" : ""}`}
                              onClick={() => handleFilterChange("date", opt)}
                            >{opt}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button className="qi-toolbar-btn"><FiDownload /> Export</button>
            </div>
          </div>
        </div>

        {/* Active filter tags */}
        {activeFilterCount > 0 && (
          <div className="qi-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value !== "All" ? (
                <span key={key} className="qi-active-filter-tag">
                  {(key === "batchId" ? "Batch ID" : key === "date" ? "Date Started" : key.charAt(0).toUpperCase() + key.slice(1))}: {value}
                  <button onClick={() => handleFilterChange(key, "All")}>✕</button>
                </span>
              ) : null
            )}
          </div>
        )}

        {/* Stat Cards */}
        <div className="qi-stats-grid">
          <div className="qi-stat-card">
            <div className="qi-stat-icon gold"><FiClipboard /></div>
            <div>
              <h3>{totalRecords}</h3>
              <p>Total Records</p>
              <span>All Time</span>
            </div>
          </div>
          <div className="qi-stat-card">
            <div className="qi-stat-icon blue"><FiShield /></div>
            <div>
              <h3>{inIsolation}</h3>
              <p>In Isolation</p>
              <span>Active</span>
            </div>
          </div>
          <div className="qi-stat-card">
            <div className="qi-stat-icon green"><FiCheckCircle /></div>
            <div>
              <h3>{recovered}</h3>
              <p>Recovered</p>
              <span>All Records</span>
            </div>
          </div>
          <div className="qi-stat-card">
            <div className="qi-stat-icon red"><FiHeart /></div>
            <div>
              <h3>{deceased}</h3>
              <p>Deceased</p>
              <span>All Records</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="qi-table-wrapper">
          <table className="qi-table">
            <thead>
              <tr>
                <th>DATE STARTED</th>
                <th>BATCH ID</th>
                <th>NUMBER OF BIRDS</th>
                <th>REASON</th>
                <th>STATUS</th>
                <th>DATE ENDED</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="qi-empty-state">
                    <div className="qi-empty-content">
                      <FiMaximize />
                      <h3>No quarantine records found</h3>
                      <p>Click Add Record to log your first quarantine or isolation entry.</p>
                      <button className="qi-empty-add-btn" onClick={() => navigate("/records/quarantine/add")}>
                        <FiPlus /> Add Record
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r._id}>
                    <td>{r.dateStarted}</td>
                    <td><span className="qi-batch-badge">{r.batchId}</span></td>
                    <td className="qi-center">{r.numberOfBirds}</td>
                    <td>{r.reason}</td>
                    <td><span className={statusClass(r.status)}>{r.status}</span></td>
                    <td>{r.dateEnded || "—"}</td>
                    <td>
                      <div className="qi-actions">
                        <button
                          className="qi-btn-edit"
                          title="Edit"
                          onClick={() => navigate(`/records/quarantine/edit/${r._id}`)}
                        >
                          <FiEdit2 />
                        </button>
                        <button className="qi-btn-archive" title="Archive">
                          <FiArchive />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="qi-table-footer">
            Showing {filtered.length} entries
          </div>
        </div>

      </div>
    </div>
  );
}