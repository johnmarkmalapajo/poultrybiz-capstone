import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus,
  FiSearch,
  FiFilter,
  FiDownload,
  FiEdit2,
  FiArchive,
  FiGrid,
  FiUsers,
  FiHeart,
  FiCalendar,
  FiMaximize,
  FiMenu,
} from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./Flockprofile.css";

export default function FlockProfile() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ status: "All", breed: "All" });
  const filterRef = useRef(null);
  const flocks = [];

  // close filter dropdown on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({ status: "All", breed: "All" });
  const activeFilterCount = Object.values(filters).filter((v) => v !== "All").length;

  const uniq = (vals) => [...new Set(vals.filter(Boolean))];
  const statusOptions = uniq(flocks.map((r) => r.status));
  const breedOptions = uniq(flocks.map((r) => r.breed));

  const filtered = flocks.filter((r) =>
    (r.batchId?.toLowerCase().includes(search.toLowerCase()) ||
      r.breed?.toLowerCase().includes(search.toLowerCase())) &&
    (filters.status === "All" || r.status === filters.status) &&
    (filters.breed === "All" || r.breed === filters.breed)
  );

  return (
    <div className="flock-page">
      <Sidebar />

      <div className="flock-main">

        <div className="flock-breadcrumb">
          <button className="flock-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>

          <span className="breadcrumb-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span>›</span>
          <span className="breadcrumb-current">FLOCK PROFILE</span>
        </div>

        <div className="flock-toolbar">
          <button
            className="add-flock-btn"
            onClick={() => navigate("/records/flock/add")}
          >
            <FiPlus />
            Add New Flock
          </button>

          <div className="toolbar-actions">
            <div className="search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search Flock..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="toolbar-btn-group">
              <div className="flock-filter-wrap" ref={filterRef}>
                <button className="toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="flock-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="flock-filter-dropdown">
                    <div className="flock-filter-dropdown-header">
                      <span>Filter Flocks</span>
                      <button className="flock-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>

                    <div className="flock-filter-group">
                      <label className="flock-filter-label">Status</label>
                      <select
                        className="flock-filter-select"
                        value={filters.status}
                        onChange={(e) => handleFilterChange("status", e.target.value)}
                      >
                        <option value="All">All Statuses</option>
                        {statusOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flock-filter-group">
                      <label className="flock-filter-label">Breed</label>
                      <select
                        className="flock-filter-select"
                        value={filters.breed}
                        onChange={(e) => handleFilterChange("breed", e.target.value)}
                      >
                        <option value="All">All Breeds</option>
                        {breedOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <button className="toolbar-btn"><FiDownload /> Export</button>
            </div>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className="flock-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value !== "All" ? (
                <span key={key} className="flock-active-filter-tag">
                  {key.charAt(0).toUpperCase() + key.slice(1)}: {value}
                  <button onClick={() => handleFilterChange(key, "All")}>✕</button>
                </span>
              ) : null
            )}
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon gold"><FiGrid /></div>
            <div>
              <h3>0</h3>
              <p>Total Flock Records</p>
              <span>All Time</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon green"><FiUsers /></div>
            <div>
              <h3>0</h3>
              <p>Total Current Birds</p>
              <span>All Records</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon red"><FiHeart /></div>
            <div>
              <h3>0%</h3>
              <p>Average Mortality Rate</p>
              <span>All Records</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon blue"><FiCalendar /></div>
            <div>
              <h3>0</h3>
              <p>Average Age (Days)</p>
              <span>All Records</span>
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="flock-table">
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>Breed</th>
                <th>Source</th>
                <th>Date Acquired</th>
                <th>Purchase Qty</th>
                <th>Current Qty</th>
                <th>Mortality Rate</th>
                <th>Age</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="10" className="empty-state">
                    <div className="empty-content">
                      <FiMaximize />
                      <h3>No flock records found</h3>
                      <p>Click Add New Flock to create your first flock profile.</p>
                      <button
                        className="empty-add-btn"
                        onClick={() => navigate("/records/flock/add")}
                      >
                        <FiPlus />
                        Add New Flock
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((flock) => (
                  <tr key={flock._id}>
                    <td>{flock.batchId}</td>
                    <td>{flock.breed}</td>
                    <td>{flock.source}</td>
                    <td>{flock.dateAcquired}</td>
                    <td>{flock.quantityPurchased}</td>
                    <td>{flock.currentQuantity}</td>
                    <td>{flock.mortalityRate}%</td>
                    <td>{flock.age} days</td>
                    <td>{flock.notes}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="action-btn edit"
                          title="Edit"
                          onClick={() => navigate(`/records/flock/edit/${flock._id}`)}
                        >
                          <FiEdit2 />
                        </button>
                        <button className="action-btn archive" title="Archive">
                          <FiArchive />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="table-footer">
            Showing {filtered.length} entries
          </div>
        </div>

      </div>
    </div>
  );
}