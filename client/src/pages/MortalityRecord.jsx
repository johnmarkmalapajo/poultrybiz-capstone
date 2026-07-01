import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload,
  FiEdit2, FiArchive, FiMenu, FiMaximize,
  FiHeart, FiFileText, FiAlertCircle,
} from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import { useUser } from "../hooks/useUser";
import "./MortalityRecord.css";

export default function MortalityRecord() {
  const navigate = useNavigate();
  const { canEdit, canArchive } = useUser();
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ causeOfDeath: "All", batchId: "All", date: "All" });
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
  const clearFilters = () => setFilters({ causeOfDeath: "All", batchId: "All", date: "All" });
  const activeFilterCount = Object.values(filters).filter((v) => v !== "All").length;

  const uniq = (vals) => [...new Set(vals.filter(Boolean))];
  const causeOptions = uniq(records.map((r) => r.causeOfDeath));
  const batchOptions = uniq(records.map((r) => r.batchId));
  const dateOptions  = uniq(records.map((r) => r.date));

  const filtered = records.filter((r) =>
    (r.batchId?.toLowerCase().includes(search.toLowerCase()) ||
      r.causeOfDeath?.toLowerCase().includes(search.toLowerCase())) &&
    (filters.causeOfDeath === "All" || r.causeOfDeath === filters.causeOfDeath) &&
    (filters.batchId === "All" || r.batchId === filters.batchId) &&
    (filters.date === "All" || r.date === filters.date)
  );

  const totalRecords = records.length;
  const totalDeaths = records.reduce((sum, r) => sum + (r.numberOfMortality || 0), 0);
  const batchesAffected = new Set(records.map((r) => r.batchId).filter(Boolean)).size;

  return (
    <div className="mr-page">
      <Sidebar />

      <div className="mr-main">

        {/* Breadcrumb */}
        <div className="mr-breadcrumb">
          <button className="mr-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="mr-bc-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span>›</span>
          <span className="mr-bc-current">MORTALITY RECORD</span>
        </div>

        {/* Toolbar */}
        <div className="mr-toolbar">
          <button className="mr-add-btn" onClick={() => navigate("/records/mortality/add")}>
            <FiPlus /> Add Mortality Record
          </button>
          <div className="mr-toolbar-right">
            <div className="mr-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="mr-btn-group">
              <div className="mr-filter-wrap" ref={filterRef}>
                <button className="mr-toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="mr-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="mr-filter-dropdown">
                    <div className="mr-filter-dropdown-header">
                      <span>Filter Records</span>
                      <button className="mr-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>

                    <div className="mr-filter-group">
                      <label className="mr-filter-label">Batch ID</label>
                      <select
                        className="mr-filter-select"
                        value={filters.batchId}
                        onChange={(e) => handleFilterChange("batchId", e.target.value)}
                      >
                        <option value="All">All Batches</option>
                        {batchOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mr-filter-group">
                      <label className="mr-filter-label">Cause of Death</label>
                      <select
                        className="mr-filter-select"
                        value={filters.causeOfDeath}
                        onChange={(e) => handleFilterChange("causeOfDeath", e.target.value)}
                      >
                        <option value="All">All Causes</option>
                        {causeOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    {dateOptions.length > 0 && (
                      <div className="mr-filter-group">
                        <label className="mr-filter-label">Date</label>
                        <div className="mr-filter-options">
                          <button
                            className={`mr-filter-option ${filters.date === "All" ? "selected" : ""}`}
                            onClick={() => handleFilterChange("date", "All")}
                          >All</button>
                          {dateOptions.map((opt) => (
                            <button
                              key={opt}
                              className={`mr-filter-option ${filters.date === opt ? "selected" : ""}`}
                              onClick={() => handleFilterChange("date", opt)}
                            >{opt}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button className="mr-toolbar-btn"><FiDownload /> Export</button>
            </div>
          </div>
        </div>

        {/* Active filter tags */}
        {activeFilterCount > 0 && (
          <div className="mr-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value !== "All" ? (
                <span key={key} className="mr-active-filter-tag">
                  {(key === "batchId" ? "Batch ID" : key === "causeOfDeath" ? "Cause of Death" : key.charAt(0).toUpperCase() + key.slice(1))}: {value}
                  <button onClick={() => handleFilterChange(key, "All")}>✕</button>
                </span>
              ) : null
            )}
          </div>
        )}

        {/* Stat Cards */}
        <div className="mr-stats-grid">
          <div className="mr-stat-card">
            <div className="mr-stat-icon gold"><FiFileText /></div>
            <div>
              <h3>{totalRecords}</h3>
              <p>Total Records</p>
              <span>All Time</span>
            </div>
          </div>
          <div className="mr-stat-card">
            <div className="mr-stat-icon red"><FiHeart /></div>
            <div>
              <h3>{totalDeaths}</h3>
              <p>Total Deaths</p>
              <span>All Records</span>
            </div>
          </div>
          <div className="mr-stat-card">
            <div className="mr-stat-icon blue"><FiAlertCircle /></div>
            <div>
              <h3>{batchesAffected}</h3>
              <p>Batches Affected</p>
              <span>All Records</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mr-table-wrapper">
          <table className="mr-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>BATCH ID</th>
                <th>NUMBER OF MORTALITY</th>
                <th>CAUSE OF DEATH</th>
                <th>REMARKS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="mr-empty-state">
                    <div className="mr-empty-content">
                      <FiMaximize />
                      <h3>No mortality records found</h3>
                      <p>Click Add Mortality Record to log your first entry.</p>
                      <button
                        className="mr-empty-add-btn"
                        onClick={() => navigate("/records/mortality/add")}
                      >
                        <FiPlus /> Add Mortality Record
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r._id}>
                    <td>{r.date}</td>
                    <td><span className="mr-batch-badge">{r.batchId}</span></td>
                    <td className="mr-mortality-count">{r.numberOfMortality}</td>
                    <td>{r.causeOfDeath}</td>
                    <td>{r.remarks || "—"}</td>
                    <td>
                      <div className="mr-actions">
                        {canEdit && (
                          <button
                            className="mr-btn-edit"
                            title="Edit"
                            onClick={() => navigate(`/records/mortality/edit/${r._id}`)}
                          >
                            <FiEdit2 />
                          </button>
                        )}
                        {canArchive && (
                          <button className="mr-btn-archive" title="Archive">
                            <FiArchive />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="mr-table-footer">
            Showing {filtered.length} entries
          </div>
        </div>

      </div>
    </div>
  );
}