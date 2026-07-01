import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus,
  FiSearch,
  FiFilter,
  FiDownload,
  FiEdit2,
  FiArchive,
  FiMenu,
  FiMaximize,
  FiLayers,
  FiCheckCircle,
  FiAlertTriangle,
  FiTrendingUp,
} from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./EggRecord.css";

export default function EggRecord() {
  const navigate = useNavigate();

  const [eggRecords, setEggRecords] = useState([]);
  const [stats, setStats] = useState({
    totalEggs: 0,
    marketableEggs: 0,
    crackedEggs: 0,
    avgDailyEggs: 0,
  });

  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ batchId: "All", date: "All" });
  const filterRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEggRecords();
  }, []);

  // close filter dropdown on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const fetchEggRecords = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/egg-records`);
      const data = await response.json();

      setEggRecords(data.records || []);
      setStats({
        totalEggs:      data.summary?.totalEggs || 0,
        marketableEggs: data.summary?.marketableEggs || 0,
        crackedEggs:    data.summary?.crackedEggs || 0,
        avgDailyEggs:   data.summary?.avgDailyEggs || 0,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({ batchId: "All", date: "All" });
  const activeFilterCount = Object.values(filters).filter((v) => v !== "All").length;

  const uniq = (vals) => [...new Set(vals.filter(Boolean))];
  const batchOptions = uniq(eggRecords.map((r) => r.batchId));
  const dateOptions  = uniq(eggRecords.map((r) => r.date));

  const filteredRecords = eggRecords.filter((record) =>
    record.batchId?.toLowerCase().includes(search.toLowerCase()) &&
    (filters.batchId === "All" || record.batchId === filters.batchId) &&
    (filters.date === "All" || record.date === filters.date)
  );

  return (
    <div className="egg-page">
      <Sidebar />

      <div className="egg-main">

        {/* Breadcrumb */}
        <div className="egg-breadcrumb">
          <button className="egg-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="breadcrumb-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span>›</span>
          <span className="breadcrumb-current">EGG RECORD</span>
        </div>

        {/* Toolbar */}
        <div className="egg-toolbar">
          <button className="add-egg-btn" onClick={() => navigate("/records/egg/add")}>
            <FiPlus />
            Add Egg Record
          </button>

          <div className="egg-toolbar-actions">
            <div className="egg-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search egg record..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="egg-btn-group">
              <div className="egg-filter-wrap" ref={filterRef}>
                <button className="egg-toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="egg-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="egg-filter-dropdown">
                    <div className="egg-filter-dropdown-header">
                      <span>Filter Records</span>
                      <button className="egg-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>

                    <div className="egg-filter-group">
                      <label className="egg-filter-label">Batch ID</label>
                      <select
                        className="egg-filter-select"
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
                      <div className="egg-filter-group">
                        <label className="egg-filter-label">Date</label>
                        <div className="egg-filter-options">
                          <button
                            className={`egg-filter-option ${filters.date === "All" ? "selected" : ""}`}
                            onClick={() => handleFilterChange("date", "All")}
                          >All</button>
                          {dateOptions.map((opt) => (
                            <button
                              key={opt}
                              className={`egg-filter-option ${filters.date === opt ? "selected" : ""}`}
                              onClick={() => handleFilterChange("date", opt)}
                            >{opt}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button className="egg-toolbar-btn"><FiDownload /> Export</button>
            </div>
          </div>
        </div>

        {/* Active filter tags */}
        {activeFilterCount > 0 && (
          <div className="egg-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value !== "All" ? (
                <span key={key} className="egg-active-filter-tag">
                  {(key === "batchId" ? "Batch ID" : key.charAt(0).toUpperCase() + key.slice(1))}: {value}
                  <button onClick={() => handleFilterChange(key, "All")}>✕</button>
                </span>
              ) : null
            )}
          </div>
        )}

        {/* Stats */}
        <div className="egg-stats-grid">
          <div className="egg-stat-card">
            <div className="egg-stat-icon gold"><FiLayers /></div>
            <div>
              <h3>{stats.totalEggs}</h3>
              <p>Total Eggs</p>
              <span>This Month</span>
            </div>
          </div>

          <div className="egg-stat-card">
            <div className="egg-stat-icon green"><FiCheckCircle /></div>
            <div>
              <h3>{stats.marketableEggs}</h3>
              <p>Marketable Eggs</p>
              <span>This Month</span>
            </div>
          </div>

          <div className="egg-stat-card">
            <div className="egg-stat-icon red"><FiAlertTriangle /></div>
            <div>
              <h3>{stats.crackedEggs}</h3>
              <p>Cracked Eggs</p>
              <span>This Month</span>
            </div>
          </div>

          <div className="egg-stat-card">
            <div className="egg-stat-icon blue"><FiTrendingUp /></div>
            <div>
              <h3>{stats.avgDailyEggs}</h3>
              <p>Avg. Daily Eggs</p>
              <span>This Month</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="egg-table-wrapper">
          <table className="egg-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Batch ID</th>
                <th>Peewee</th>
                <th>Small</th>
                <th>Medium</th>
                <th>Large</th>
                <th>Extra Large</th>
                <th>Jumbo</th>
                <th>Cracked Eggs</th>
                <th>Good Eggs</th>
                <th>Total Eggs</th>
                <th>Hen-Day %</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="13" className="egg-loading-cell">Loading egg records...</td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="13" className="egg-empty-state">
                    <div className="egg-empty-content">
                      <FiMaximize />
                      <h3>No egg records found</h3>
                      <p>Click Add Egg Record to log your first egg collection.</p>
                      <button
                        className="egg-empty-add-btn"
                        onClick={() => navigate("/records/egg/add")}
                      >
                        <FiPlus />
                        Add Egg Record
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record._id}>
                    <td>{record.collectionDate}</td>
                    <td><span className="egg-badge">{record.batchId}</span></td>
                    <td>{record.peewee}</td>
                    <td>{record.small}</td>
                    <td>{record.medium}</td>
                    <td>{record.large}</td>
                    <td>{record.extraLarge}</td>
                    <td>{record.jumbo}</td>
                    <td>{record.crackedEggs}</td>
                    <td>{record.goodEggs}</td>
                    <td className="egg-total">{record.totalEggs}</td>
                    <td>{record.henDayPercent}%</td>
                    <td>
                      <div className="egg-action-buttons">
                        <button
                          className="egg-action-btn edit"
                          title="Edit"
                          onClick={() => navigate(`/records/egg/edit/${record._id}`)}
                        >
                          <FiEdit2 />
                        </button>
                        <button className="egg-action-btn archive" title="Archive">
                          <FiArchive />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="egg-table-footer">
            Showing {filteredRecords.length} entries
          </div>
        </div>

      </div>
    </div>
  );
}