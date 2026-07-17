import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload,
  FiEdit2, FiArchive, FiMaximize,
  FiHeart, FiFileText, FiAlertCircle,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import ExportMenu from "../components/ExportMenu";
import { useUser } from "../hooks/useUser";
import "./MortalityRecord.css";
import { archiveRow } from "../archiveRow";

const MORT_API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/mortality-records`;

export default function MortalityRecord() {
  const navigate = useNavigate();
  const { canEdit, canArchive } = useUser();
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ causeOfDeath: "All", batchId: "All", dateFrom: "", dateTo: "" });
  const filterRef = useRef(null);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(MORT_API)
      .then((r) => r.json())
      .then((d) => setRecords(Array.isArray(d) ? d : d.records || d.data || []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({ causeOfDeath: "All", batchId: "All", dateFrom: "", dateTo: "" });
  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && v !== "All").length;

  const uniq = (vals) => [...new Set(vals.filter(Boolean))];
  const causeOptions = uniq(records.map((r) => r.causeOfDeath));
  const batchOptions = uniq(records.map((r) => r.batchId));

  const filtered = records.filter((r) =>
    (r.batchId?.toLowerCase().includes(search.toLowerCase()) ||
      r.causeOfDeath?.toLowerCase().includes(search.toLowerCase())) &&
    (filters.causeOfDeath === "All" || r.causeOfDeath === filters.causeOfDeath) &&
    (filters.batchId === "All" || r.batchId === filters.batchId) &&
    (!filters.dateFrom || r.date >= filters.dateFrom) && (!filters.dateTo || r.date <= filters.dateTo)
  );

  const totalRecords = records.length;
  const totalDeaths = records.reduce((sum, r) => sum + (r.numberOfMortality || 0), 0);
  const batchesAffected = new Set(records.map((r) => r.batchId).filter(Boolean)).size;

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "RECORDS", path: "/records" },
        { label: "MORTALITY RECORD" },
      ]}
    >
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

                    <div className="mr-filter-group">
                      <label className="mr-filter-label">Date Range</label>
                      <div className="mr-filter-date-range">
                        <input type="date" className="mr-filter-select" value={filters.dateFrom}
                          onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label="From date" />
                        <span>to</span>
                        <input type="date" className="mr-filter-select" value={filters.dateTo}
                          onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label="To date" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <ExportMenu rows={filtered} name="mortality-record" title="Mortality Record" className="mr-toolbar-btn" />
            </div>
          </div>
        </div>

        {/* Active filter tags */}
        {activeFilterCount > 0 && (
          <div className="mr-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value && value !== "All" ? (
                <span key={key} className="mr-active-filter-tag">
                  {key === "batchId" ? "Batch ID" : key === "causeOfDeath" ? "Cause of Death" : key === "dateFrom" ? "From" : key === "dateTo" ? "To" : key}: {value}
                  <button onClick={() => handleFilterChange(key, key === "batchId" || key === "causeOfDeath" ? "All" : "")}>✕</button>
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
                <th>CAGE</th>
                <th>NUMBER OF MORTALITY</th>
                <th>CAUSE OF DEATH</th>
                <th>SUSPECTED DISEASE</th>
                <th>REMARKS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="mr-empty-state">Loading mortality records...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="mr-empty-state">
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
                    <td>{r.cageId || "—"}</td>
                    <td className="mr-mortality-count">{r.numberOfMortality}</td>
                    <td>{r.causeOfDeath}</td>
                    <td>{r.suspectedDisease || "—"}</td>
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
                          <button className="mr-btn-archive" onClick={() => archiveRow({ module: "Mortality Records", moduleKey: "pb_mortality", record: r, name: r.batchId || r.date })} title="Archive">
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

    </PageLayout>
  );
}