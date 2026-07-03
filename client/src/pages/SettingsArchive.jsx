import React, { useState, useEffect } from 'react';
import './SettingsArchive.css';

export default function SettingsArchive({ onBack }) {
  const [archivedItems, setArchivedItems] = useState([]);
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    setCurrentDate(today.toLocaleDateString('en-US', options));
  }, []);

  const handleRestore = (id) => {
    alert(`Restoring archived record ID: ${id}`);
  };

  const handleDelete = (id) => {
    alert(`Permanently deleting record ID: ${id}`);
  };

  return (
    <div className="audit-logs-workspace-container">
      
      {/* ================= LOWER METADATA ROW (DATE & BELL ONLY) ================= */}
      <div className="logs-lower-meta-row">
        <div className="notification-bell-trigger-badge" title="Notifications">
          🔔 {archivedItems.length > 0 && <span className="badge-count-dot">{archivedItems.length}</span>}
        </div>
        <div className="date-stamp-calendar-display">
          Today: {currentDate || "Loading Date..."}
        </div>
      </div>

      {/* ================= THE EXACT SALES-RECORD / AUDIT LOGS TOOLBAR ================= */}
      <div className="sr-toolbar">
        <div className="sr-toolbar-actions">
          
          {/* LEFT SIDE: Search Box, Date Range, at Module Controls */}
          <div className="archive-filters-left-cluster">
            
            {/* Search Input na nasa pinakakaliwa */}
            <div className="sr-search-box">
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                <path d="M456.69 421.39L362.6 327.3a173.81 173.81 0 10-35.31 35.31l94.09 94.09a25 25 0 0035.31-35.31zM224 338a114 114 0 11114-114 114.13 114.13 0 01-114 114z"></path>
              </svg>
              <input type="text" placeholder="Search archived records..." />
            </div>

            {/* Date Range Selector Input */}
            <div className="logs-inline-select-node">
              <input 
                className="logs-clean-date"
                type="text" 
                placeholder="Select Date Range" 
                onFocus={(e) => e.target.type = 'date'} 
                onBlur={(e) => e.target.type = 'text'} 
              />
            </div>

            {/* Module Filter Dropdown Selector */}
            <div className="logs-inline-select-node">
              <select defaultValue="">
                <option value="" disabled hidden>Module</option>
                <option value="eggs">Egg Record</option>
                <option value="feeds">Feed Stock</option>
              </select>
            </div>

          </div>

          {/* RIGHT SIDE: Filter at Export Buttons na Magkatabi */}
          <div className="sr-btn-group">
            <button className="sr-toolbar-btn" type="button">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              Filter
            </button>
            
            <button className="sr-toolbar-btn" type="button">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Export
            </button>
          </div>

        </div>
      </div>

      {/* ================= FLOATING INFORMATIONAL WARNING BANNER ================= */}
      <div className="archive-warning-info-banner">
        <span className="warning-banner-icon">⚠️</span>
        <p className="warning-banner-text">
          Archived records are hidden from active lists. You can restore or permanently delete them.
        </p>
      </div>

      {/* ================= CORE ARCHIVE DATA TABLE STYLE PARAMETERS ================= */}
      <div className="logs-table-responsive-wrapper">
        <table className="logs-data-core-table">
          <thead>
            <tr>
              <th>Date Archived ⇅</th>
              <th>Module ⇅</th>
              <th>Record Description ⇅</th>
              <th>Archived By ⇅</th>
              <th>Reason ⇅</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {archivedItems.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '38px', color: 'var(--text-second)', fontStyle: 'italic' }}>
                  No archived database files or records found.
                </td>
              </tr>
            ) : (
              archivedItems.map((item) => (
                <tr key={item.id}>
                  <td className="col-timestamp">{item.date}</td>
                  <td className="col-user">{item.module}</td>
                  <td className="col-details">{item.desc}</td>
                  <td>{item.user}</td>
                  <td className="cell-archive-reason-text">{item.reason}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div className="cell-action-buttons-pair">
                      <button className="btn-action-archive-restore" onClick={() => handleRestore(item.id)}>Restore</button>
                      <button className="btn-action-archive-delete" onClick={() => handleDelete(item.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ================= PAGINATION FOOTER CONTROL LAYOUT ================= */}
      <div className="logs-pagination-footer-nav-bar">
        <span className="pagination-entries-counter">
          Showing {archivedItems.length === 0 ? 0 : 1} to {archivedItems.length} of {archivedItems.length} archived records
        </span>
        <div className="pagination-button-group-node">
          <button className="btn-page-node active-page-bubble" disabled={archivedItems.length === 0}>1</button>
          <button className="btn-page-node" disabled={archivedItems.length === 0}>2</button>
          <button className="btn-page-node" disabled={archivedItems.length === 0}>3</button>
          <span className="pagination-spacer-dots">...</span>
          <button className="btn-page-node" disabled={archivedItems.length === 0}>5</button>
        </div>
      </div>

    </div>
  );
}