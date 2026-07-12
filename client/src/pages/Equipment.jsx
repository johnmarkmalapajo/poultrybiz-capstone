import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload, FiEdit2, FiArchive,
  FiGrid, FiPackage, FiDollarSign, FiCheckCircle, FiMaximize, FiMenu,
} from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import ExportMenu from "../components/ExportMenu";
import { useUser } from "../hooks/useUser";
import "./Equipment.css";
import { archiveRow } from "../archiveRow";

const CONDITION_OPTIONS = ["Good", "Fair", "Poor"];

export default function Equipment() {
  const navigate = useNavigate();
  const { canEdit, canArchive, canSeeFinancials } = useUser();
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/equipment");
        const data = await res.json();
        setRecords(Array.isArray(data) ? data : data.records || data.data || []);
      } catch { setRecords([]); }
    })();
  }, []);

  // ── Filter (Expenses-style inline dropdown) ──
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ condition: "All" });
  const filterRef = useRef(null);

  useEffect(() => {
    const handle = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({ condition: "All" });
  const activeFilterCount = Object.values(filters).filter((v) => v !== "All").length;

  const filtered = records.filter((r) => {
    const matchSearch =
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase()) ||
      r.itemNo?.toLowerCase().includes(search.toLowerCase());
    const matchCondition = filters.condition === "All" || r.condition === filters.condition;
    return matchSearch && matchCondition;
  });

  // ── Stats ──
  const totalItems = records.length;
  const totalQuantity = records.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const totalValue = records.reduce((s, r) => s + (Number(r.cost) || 0), 0);
  const goodCondition = records.filter((r) => r.condition === "Good").length;

  const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;

  return (
    <div className="eq-page">
      <Sidebar />

      <div className="eq-main">

        <div className="eq-breadcrumb">
          <button className="eq-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="breadcrumb-link" onClick={() => navigate("/inventory")}>INVENTORY</span>
          <span>›</span>
          <span className="breadcrumb-current">EQUIPMENT &amp; TOOLS RECORD</span>
        </div>

        <div className="eq-toolbar">
          <button className="add-eq-btn" onClick={() => navigate("/inventory/equipment/add")}>
            <FiPlus />
            Add Equipment
          </button>

          <div className="toolbar-actions">
            <div className="search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search equipment..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="toolbar-btn-group">
              {/* Filter — inline dropdown (Expenses-style) */}
              <div className="eq-filter-wrap" ref={filterRef}>
                <button className="toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="eq-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="eq-filter-dropdown">
                    <div className="eq-filter-dropdown-header">
                      <span>Filter Records</span>
                      <button className="eq-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>

                    <div className="eq-filter-group">
                      <label className="eq-filter-label">Condition</label>
                      <select
                        className="eq-filter-select"
                        value={filters.condition}
                        onChange={(e) => handleFilterChange("condition", e.target.value)}
                      >
                        <option value="All">All Conditions</option>
                        {CONDITION_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <ExportMenu rows={filtered} name="equipment" title="Equipment & Tools" className="toolbar-btn" />
            </div>
          </div>
        </div>

        {/* Active filter tags */}
        {activeFilterCount > 0 && (
          <div className="eq-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value !== "All" ? (
                <span key={key} className="eq-active-filter-tag">
                  {key === "condition" ? "Condition" : key}: {value}
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
              <h3>{totalItems}</h3>
              <p>Total Items</p>
              <span>All Records</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon blue"><FiPackage /></div>
            <div>
              <h3>{totalQuantity}</h3>
              <p>Total Quantity</p>
              <span>All Units</span>
            </div>
          </div>

          {canSeeFinancials && (
            <div className="stat-card">
              <div className="stat-icon green"><FiDollarSign /></div>
              <div>
                <h3>{peso(totalValue)}</h3>
                <p>Total Value</p>
                <span>Acquisition Cost</span>
              </div>
            </div>
          )}

          <div className="stat-card">
            <div className="stat-icon green"><FiCheckCircle /></div>
            <div>
              <h3>{goodCondition}</h3>
              <p>Good Condition</p>
              <span>Items</span>
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="eq-table">
            <thead>
              <tr>
                <th>Item No.</th>
                <th>Equipment/Tool Name</th>
                <th>Description/Specifications</th>
                <th>Serial/ID No.</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Condition</th>
                <th>Location/Storage</th>
                <th>Custodian/Assigned To</th>
                <th>Date Acquired</th>
                {canSeeFinancials && <th>Acquisition Cost</th>}
                <th>Remarks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canSeeFinancials ? 13 : 12} className="empty-state">
                    <div className="empty-content">
                      <FiMaximize />
                      <h3>No equipment records found</h3>
                      <p>Click Add Equipment to record your first item.</p>
                      <button className="empty-add-btn" onClick={() => navigate("/inventory/equipment/add")}>
                        <FiPlus />
                        Add Equipment
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="eq-item-no">{r.itemNo}</td>
                    <td>{r.name}</td>
                    <td className="eq-desc">{r.description}</td>
                    <td>{r.serialNo}</td>
                    <td>{r.quantity}</td>
                    <td>{r.unit}</td>
                    <td>
                      <span className={`eq-condition ${r.condition?.toLowerCase()}`}>{r.condition}</span>
                    </td>
                    <td>{r.location}</td>
                    <td>{r.custodian}</td>
                    <td>{r.dateAcquired}</td>
                    {canSeeFinancials && <td>{peso(r.cost)}</td>}
                    <td>{r.remarks}</td>
                    <td>
                      <div className="action-buttons">
                        {canEdit && (
                          <button
                            className="action-btn edit"
                            title="Edit"
                            onClick={() => {
                              localStorage.setItem("editEquipment", JSON.stringify(r));
                              navigate(`/inventory/equipment/edit/${r.id}`);
                            }}
                          >
                            <FiEdit2 />
                          </button>
                        )}
                        {canArchive && (
                          <button className="action-btn archive" onClick={() => archiveRow({ module: "Equipment & Tools", moduleKey: "pb_equipment", record: r, name: r.name || r.equipmentName })} title="Archive">
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

          <div className="table-footer">
            Showing {filtered.length} entries
          </div>
        </div>

      </div>
    </div>
  );
}
