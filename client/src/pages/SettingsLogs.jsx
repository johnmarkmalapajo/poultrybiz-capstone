import React, { useState, useEffect } from 'react';
import { FiSearch, FiFilter, FiDownload } from "react-icons/fi"; 
import './SettingsLogs.css';

export default function SettingsLogs({ onBack }) {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState(""); 
  const [currentDate, setCurrentDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    setCurrentDate(today.toLocaleDateString('en-US', options));
  }, []);

  const filteredLogs = logs.filter((log) =>
    log.user?.toLowerCase().includes(search.toLowerCase()) ||
    log.action?.toLowerCase().includes(search.toLowerCase()) ||
    log.module?.toLowerCase().includes(search.toLowerCase()) ||
    log.desc?.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    if (logs.length === 0) return;
    const headers = ["Timestamp", "User", "Action", "Module", "Description"];
    const rows = logs.map((item) => [
      item.timestamp || '',
      item.user || '',
      item.action || '',
      item.module || '',
      item.desc || ''
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="audit-logs-workspace-container">
      
      {/* ================= EXACT SALES-RECORD TOOLBAR ALIGNMENT LAYOUT ================= */}
      <div className="sr-toolbar">
        <div className="sr-toolbar-actions">
          
          {/* Left Side: Search Box */}
          <div className="sr-search-box">
            <FiSearch />
            <input
              type="text"
              placeholder="Search activity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Right Side: Button Groups Exactly from Sales Record */}
          <div className="sr-btn-group">
            <button 
              className={`sr-toolbar-btn ${showFilters ? 'active-filter-btn' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <FiFilter /> Filter
            </button>
            <button className="sr-toolbar-btn" onClick={handleExport}>
              <FiDownload /> Export
            </button>
          </div>

        </div>
      </div>

      {/* ================= LOWER META BLOCK (Bell and Date Stamp now placed below Toolbar) ================= */}
      <div className="logs-lower-meta-row">
        <div className="notification-bell-trigger-badge" title="Notifications">
          🔔 {logs.length > 0 && <span className="badge-count-dot">{logs.length}</span>}
        </div>
        <div className="date-stamp-calendar-display">
          📅 Today: {currentDate || "Loading Date..."}
        </div>
      </div>

      {/* ================= EXPANDABLE ADVANCED FILTER DRAWER ================= */}
      {showFilters && (
        <div className="logs-advanced-filter-drawer">
          <div className="logs-inline-select-node">
            <select defaultValue="">
              <option value="" disabled hidden>Filter Action</option>
              <option value="all">All Actions</option>
              <option value="add">Added Record</option>
              <option value="update">Updated Data</option>
              <option value="archive">Archived Record</option>
            </select>
          </div>

          <div className="logs-inline-select-node">
            <input type="date" title="Select Date Range" className="logs-clean-date" />
          </div>

          <div className="logs-inline-select-node">
            <select defaultValue="">
              <option value="" disabled hidden>User</option>
              <option value="all">All Users</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
            </select>
          </div>
        </div>
      )}

      {/* ================= THE STRUCTURAL DATA TABLE ROW GRID ================= */}
      <div className="logs-table-responsive-wrapper">
        <table className="logs-data-core-table">
          <thead>
            <tr>
              <th>Timestamp ⇅</th>
              <th>User ⇅</th>
              <th>Action ⇅</th>
              <th>Module ⇅</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#718096', fontStyle: 'italic' }}>
                  No operational audit logs found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((item, index) => (
                <tr key={index}>
                  <td className="cell-timestamp">{item.timestamp}</td>
                  <td className="cell-user-identity"><strong>{item.user}</strong></td>
                  <td>
                    <span className={`action-pill-tag ${item.action ? item.action.toLowerCase().replace(/\s+/g, "-") : ""}`}>
                      {item.action}
                    </span>
                  </td>
                  <td className="cell-module-category">{item.module}</td>
                  <td className="cell-description-text">{item.desc}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer Controls Row Section Layout */}
      <div className="logs-pagination-footer-nav-bar">
        <span className="pagination-entries-counter">
          Showing {filteredLogs.length} entries
        </span>
        <div className="pagination-button-group-node">
          <button className="btn-page-node active-page-bubble" disabled={filteredLogs.length === 0}>1</button>
          <button className="btn-page-node" disabled={filteredLogs.length === 0}>2</button>
          <button className="btn-page-node" disabled={filteredLogs.length === 0}>3</button>
          <span className="pagination-spacer-dots">...</span>
          <button className="btn-page-node" disabled={filteredLogs.length === 0}>9</button>
        </div>
      </div>
      
    </div>
  );
}