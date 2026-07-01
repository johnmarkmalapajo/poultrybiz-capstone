import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload,
  FiEdit2, FiArchive, FiMenu, FiMaximize, FiShield,
  FiClipboard, FiCheckCircle, FiHeart, FiAlertCircle,
} from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./QuarantineandIsolation.css";

const QUARANTINE_STATUS = ["Ongoing", "Cleared", "Released"];
const ISOLATION_STATUS = ["In Isolation", "Recovered", "Deceased"];

export default function QuarantineIsolation() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ status: "All", batchId: "All", date: "All" });
  const filterRef = useRef(null);
  const [activeTab, setActiveTab] = useState(
    params.get("tab") === "isolation" ? "isolation" : "quarantine"
  );

  const quarantineRecords = [];
  const isolationRecords = [];

  // close filter dropdown on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const isQuarantine = activeTab === "quarantine";

  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({ status: "All", batchId: "All", date: "All" });
  const activeFilterCount = Object.values(filters).filter((v) => v !== "All").length;

  // switching tabs resets the filter (columns differ per table)
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearch("");
    setFilters({ status: "All", batchId: "All", date: "All" });
    setShowFilter(false);
  };

  // -- Tab-aware filter options --
  const activeSource = isQuarantine ? quarantineRecords : isolationRecords;
  const uniq = (vals) => [...new Set(vals.filter(Boolean))];
  const statusOptions = isQuarantine ? QUARANTINE_STATUS : ISOLATION_STATUS;
  const batchOptions = uniq(activeSource.map((r) => r.batchId));
  const dateLabel = isQuarantine ? "Date Acquired" : "Date Isolated";
  const dateOptions = uniq(activeSource.map((r) => (isQuarantine ? r.dateAcquired : r.dateIsolated)));

  const filteredQuarantine = quarantineRecords.filter((r) =>
    (r.batchId?.toLowerCase().includes(search.toLowerCase()) ||
      r.source?.toLowerCase().includes(search.toLowerCase()) ||
      r.status?.toLowerCase().includes(search.toLowerCase())) &&
    (filters.status === "All" || r.status === filters.status) &&
    (filters.batchId === "All" || r.batchId === filters.batchId) &&
    (filters.date === "All" || r.dateAcquired === filters.date)
  );

  const filteredIsolation = isolationRecords.filter((r) =>
    (r.cageId?.toLowerCase().includes(search.toLowerCase()) ||
      r.batchId?.toLowerCase().includes(search.toLowerCase()) ||
      r.symptoms?.toLowerCase().includes(search.toLowerCase()) ||
      r.currentStatus?.toLowerCase().includes(search.toLowerCase())) &&
    (filters.status === "All" || r.currentStatus === filters.status) &&
    (filters.batchId === "All" || r.batchId === filters.batchId) &&
    (filters.date === "All" || r.dateIsolated === filters.date)
  );

  const statusClass = (status) => {
    const s = (status || "").toLowerCase();
    if (s.includes("isolat"))  return "qi-status qi-status-isolate";
    if (s.includes("recover")) return "qi-status qi-status-recovered";
    if (s.includes("deceas"))  return "qi-status qi-status-deceased";
    if (s.includes("ongoing")) return "qi-status qi-status-ongoing";
    if (s.includes("clear"))   return "qi-status qi-status-cleared";
    if (s.includes("release")) return "qi-status qi-status-released";
    return "qi-status";
  };

  // -- Stats (tab-aware) --
  const countBy = (arr, field, val) =>
    arr.filter((r) => (r[field] || "").toLowerCase() === val).length;

  const qTotal = quarantineRecords.length;
  const qOngoing = countBy(quarantineRecords, "status", "ongoing");
  const qReleased =
    countBy(quarantineRecords, "status", "released") + countBy(quarantineRecords, "status", "cleared");
  const qHeads = quarantineRecords.reduce((s, r) => s + (Number(r.headCount) || 0), 0);

  const iTotal = isolationRecords.length;
  const iIsolation = isolationRecords.filter((r) =>
    (r.currentStatus || "").toLowerCase().includes("isolat")
  ).length;
  const iRecovered = countBy(isolationRecords, "currentStatus", "recovered");
  const iDeceased = countBy(isolationRecords, "currentStatus", "deceased");

  const addRoute = `/records/quarantine/add?type=${isQuarantine ? "quarantine" : "isolation"}`;
  const addLabel = isQuarantine ? "Add Quarantine Record" : "Add Isolation Record";

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
          <button className="qi-add-btn" onClick={() => navigate(addRoute)}>
            <FiPlus /> {addLabel}
          </button>
          <div className="qi-toolbar-right">
            <div className="qi-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder={isQuarantine ? "Search quarantine record..." : "Search isolation record..."}
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
                      <span>Filter {isQuarantine ? "Quarantine" : "Isolation"} Records</span>
                      <button className="qi-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>

                    <div className="qi-filter-group">
                      <label className="qi-filter-label">{isQuarantine ? "Status" : "Current Status"}</label>
                      <div className="qi-filter-options">
                        <button
                          className={`qi-filter-option ${filters.status === "All" ? "selected" : ""}`}
                          onClick={() => handleFilterChange("status", "All")}
                        >All</button>
                        {statusOptions.map((opt) => (
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
                        <label className="qi-filter-label">{dateLabel}</label>
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
                  {(key === "batchId" ? "Batch ID" : key === "date" ? dateLabel : key === "status" ? (isQuarantine ? "Status" : "Current Status") : key)}: {value}
                  <button onClick={() => handleFilterChange(key, "All")}>✕</button>
                </span>
              ) : null
            )}
          </div>
        )}

        {/* Stat Cards (tab-aware) */}
        <div className="qi-stats-grid">
          {isQuarantine ? (
            <>
              <div className="qi-stat-card">
                <div className="qi-stat-icon gold"><FiClipboard /></div>
                <div><h3>{qTotal}</h3><p>Total Quarantine</p><span>All Records</span></div>
              </div>
              <div className="qi-stat-card">
                <div className="qi-stat-icon blue"><FiShield /></div>
                <div><h3>{qOngoing}</h3><p>Ongoing</p><span>Active</span></div>
              </div>
              <div className="qi-stat-card">
                <div className="qi-stat-icon green"><FiCheckCircle /></div>
                <div><h3>{qReleased}</h3><p>Cleared / Released</p><span>All Records</span></div>
              </div>
              <div className="qi-stat-card">
                <div className="qi-stat-icon gold"><FiClipboard /></div>
                <div><h3>{qHeads}</h3><p>Total Head Count</p><span>Quarantined</span></div>
              </div>
            </>
          ) : (
            <>
              <div className="qi-stat-card">
                <div className="qi-stat-icon gold"><FiClipboard /></div>
                <div><h3>{iTotal}</h3><p>Total Isolation</p><span>All Records</span></div>
              </div>
              <div className="qi-stat-card">
                <div className="qi-stat-icon blue"><FiAlertCircle /></div>
                <div><h3>{iIsolation}</h3><p>In Isolation</p><span>Active</span></div>
              </div>
              <div className="qi-stat-card">
                <div className="qi-stat-icon green"><FiCheckCircle /></div>
                <div><h3>{iRecovered}</h3><p>Recovered</p><span>All Records</span></div>
              </div>
              <div className="qi-stat-card">
                <div className="qi-stat-icon red"><FiHeart /></div>
                <div><h3>{iDeceased}</h3><p>Deceased</p><span>All Records</span></div>
              </div>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="qi-tabs">
          <button
            className={`qi-tab ${isQuarantine ? "active" : ""}`}
            onClick={() => handleTabChange("quarantine")}
          >
            <FiShield /> Quarantine Record
          </button>
          <button
            className={`qi-tab ${!isQuarantine ? "active" : ""}`}
            onClick={() => handleTabChange("isolation")}
          >
            <FiAlertCircle /> Isolation Record
          </button>
        </div>

        {/* Table */}
        <div className="qi-table-wrapper">

          {/* QUARANTINE TABLE */}
          {isQuarantine && (
            <table className="qi-table">
              <thead>
                <tr>
                  <th>BATCH ID</th>
                  <th>DATE ACQUIRED</th>
                  <th>SOURCE</th>
                  <th>BREED</th>
                  <th>HEAD COUNT</th>
                  <th>VITAMINS GIVEN</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuarantine.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="qi-empty-state">
                      <div className="qi-empty-content">
                        <FiMaximize />
                        <h3>No quarantine records found</h3>
                        <p>Click Add Quarantine Record to log a newly arrived batch.</p>
                        <button className="qi-empty-add-btn" onClick={() => navigate(addRoute)}>
                          <FiPlus /> Add Quarantine Record
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredQuarantine.map((r) => (
                    <tr key={r._id}>
                      <td><span className="qi-batch-badge">{r.batchId}</span></td>
                      <td>{r.dateAcquired}</td>
                      <td>{r.source}</td>
                      <td>{r.breed || "—"}</td>
                      <td className="qi-center">{r.headCount}</td>
                      <td>{r.vitaminsGiven}</td>
                      <td><span className={statusClass(r.status)}>{r.status}</span></td>
                      <td>
                        <div className="qi-actions">
                          <button className="qi-btn-edit" title="Edit"
                            onClick={() => navigate(`/records/quarantine/edit/${r._id}?type=quarantine`)}>
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
          )}

          {/* ISOLATION TABLE */}
          {!isQuarantine && (
            <table className="qi-table">
              <thead>
                <tr>
                  <th>CAGE ID</th>
                  <th>BATCH ID</th>
                  <th>DATE ISOLATED</th>
                  <th>CURRENT STATUS</th>
                  <th>SYMPTOMS / REASONS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredIsolation.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="qi-empty-state">
                      <div className="qi-empty-content">
                        <FiMaximize />
                        <h3>No isolation records found</h3>
                        <p>Click Add Isolation Record to log a symptomatic bird.</p>
                        <button className="qi-empty-add-btn" onClick={() => navigate(addRoute)}>
                          <FiPlus /> Add Isolation Record
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredIsolation.map((r) => (
                    <tr key={r._id}>
                      <td><span className="qi-batch-badge">{r.cageId}</span></td>
                      <td>{r.batchId}</td>
                      <td>{r.dateIsolated}</td>
                      <td><span className={statusClass(r.currentStatus)}>{r.currentStatus}</span></td>
                      <td>{r.symptoms}</td>
                      <td>
                        <div className="qi-actions">
                          <button className="qi-btn-edit" title="Edit"
                            onClick={() => navigate(`/records/quarantine/edit/${r._id}?type=isolation`)}>
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
          )}

          <div className="qi-table-footer">
            Showing {isQuarantine ? filteredQuarantine.length : filteredIsolation.length} entries
          </div>
        </div>

      </div>
    </div>
  );
}