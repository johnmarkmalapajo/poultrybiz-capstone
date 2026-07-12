import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload,
  FiEdit2, FiArchive, FiMenu, FiMaximize,
  FiPackage, FiTrash2, FiClipboard, FiLayers,
} from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import ExportMenu from "../components/ExportMenu";
import "./ManureandWasteRecord.css";
import { archiveRow } from "../archiveRow";

export default function ManureWasteRecord() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") === "waste" ? "waste" : "manure"
  );
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ category: "All", date: "All" });
  const filterRef = useRef(null);

  // Load records (mock API) and split per tab by recordType.
  const [allRecords, setAllRecords] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/waste-records");
        const data = await res.json();
        setAllRecords(Array.isArray(data) ? data : data.records || data.data || []);
      } catch { setAllRecords([]); }
    })();
  }, []);
  const manureRecords = allRecords.filter((r) => r.recordType !== "Waste");
  const wasteRecords = allRecords.filter((r) => r.recordType === "Waste");

  useEffect(() => {
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({ category: "All", date: "All" });
  const activeFilterCount = Object.values(filters).filter((v) => v !== "All").length;

  const filteredManure = manureRecords.filter((r) =>
    (r.batchId?.toLowerCase().includes(search.toLowerCase()) ||
      r.methodOfHandling?.toLowerCase().includes(search.toLowerCase())) &&
    (filters.category === "All" || r.methodOfHandling === filters.category) &&
    (filters.date === "All" || r.date === filters.date)
  );

  const filteredWaste = wasteRecords.filter((r) =>
    (r.wasteType?.toLowerCase().includes(search.toLowerCase()) ||
      r.disposalMethod?.toLowerCase().includes(search.toLowerCase())) &&
    (filters.category === "All" || r.wasteType === filters.category) &&
    (filters.date === "All" || r.date === filters.date)
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearch("");
    setFilters({ category: "All", date: "All" });
    setShowFilter(false);
  };

  const isManure = activeTab === "manure";

  // -- Tab-aware filter --
  const uniq = (vals) => [...new Set(vals.filter(Boolean))];
  const categoryLabel = isManure ? "Method of Handling" : "Waste Type";
  const categoryOptions = isManure
    ? uniq(manureRecords.map((r) => r.methodOfHandling))
    : uniq(wasteRecords.map((r) => r.wasteType));
  const dateOptions = uniq((isManure ? manureRecords : wasteRecords).map((r) => r.date));

  // ── Combined stats (manure + waste) ──
  const totalManure = manureRecords.length;
  const totalWaste = wasteRecords.length;
  const totalCollected = manureRecords.reduce(
    (sum, r) => sum + (Number(r.quantityCollected) || 0), 0
  );

  return (
    <div className="mwr-page">
      <Sidebar />

      <div className="mwr-main">

        {/* Breadcrumb */}
        <div className="mwr-breadcrumb">
          <button className="mwr-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="mwr-bc-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span>›</span>
          <span className="mwr-bc-current">MANURE AND WASTE RECORD</span>
        </div>

        {/* Toolbar */}
        <div className="mwr-toolbar">
          <button
            className="mwr-add-btn"
            onClick={() => navigate(isManure ? "/records/manure/add" : "/records/waste/add")}
          >
            <FiPlus /> {isManure ? "Add Manure Record" : "Add Waste Record"}
          </button>
          <div className="mwr-toolbar-right">
            <div className="mwr-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder={isManure ? "Search manure record..." : "Search waste record..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="mwr-btn-group">
              <div className="mwr-filter-wrap" ref={filterRef}>
                <button className="mwr-toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="mwr-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="mwr-filter-dropdown">
                    <div className="mwr-filter-dropdown-header">
                      <span>Filter {isManure ? "Manure" : "Waste"} Records</span>
                      <button className="mwr-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>

                    {/* Tab-specific category — Method of Handling OR Waste Type */}
                    <div className="mwr-filter-group">
                      <label className="mwr-filter-label">{categoryLabel}</label>
                      <select
                        className="mwr-filter-select"
                        value={filters.category}
                        onChange={(e) => handleFilterChange("category", e.target.value)}
                      >
                        <option value="All">All</option>
                        {categoryOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    {dateOptions.length > 0 && (
                      <div className="mwr-filter-group">
                        <label className="mwr-filter-label">Date</label>
                        <div className="mwr-filter-options">
                          <button
                            className={`mwr-filter-option ${filters.date === "All" ? "selected" : ""}`}
                            onClick={() => handleFilterChange("date", "All")}
                          >All</button>
                          {dateOptions.map((opt) => (
                            <button
                              key={opt}
                              className={`mwr-filter-option ${filters.date === opt ? "selected" : ""}`}
                              onClick={() => handleFilterChange("date", opt)}
                            >{opt}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <ExportMenu rows={filteredManure} name="manure-waste-record" title="Manure Waste Record" className="mwr-toolbar-btn" />
            </div>
          </div>
        </div>

        {/* Active filter tags */}
        {activeFilterCount > 0 && (
          <div className="mwr-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value !== "All" ? (
                <span key={key} className="mwr-active-filter-tag">
                  {(key === "category" ? categoryLabel : "Date")}: {value}
                  <button onClick={() => handleFilterChange(key, "All")}>✕</button>
                </span>
              ) : null
            )}
          </div>
        )}

        {/* Stat Cards (combined — manure + waste) */}
        <div className="mwr-stats-grid">
          <div className="mwr-stat-card">
            <div className="mwr-stat-icon gold"><FiClipboard /></div>
            <div>
              <h3>{totalManure + totalWaste}</h3>
              <p>Total Records</p>
              <span>Manure + Waste</span>
            </div>
          </div>
          <div className="mwr-stat-card">
            <div className="mwr-stat-icon blue"><FiPackage /></div>
            <div>
              <h3>{totalManure}</h3>
              <p>Manure Records</p>
              <span>All Time</span>
            </div>
          </div>
          <div className="mwr-stat-card">
            <div className="mwr-stat-icon red"><FiTrash2 /></div>
            <div>
              <h3>{totalWaste}</h3>
              <p>Waste Records</p>
              <span>All Time</span>
            </div>
          </div>
          <div className="mwr-stat-card">
            <div className="mwr-stat-icon green"><FiLayers /></div>
            <div>
              <h3>{totalCollected} kg</h3>
              <p>Manure Collected</p>
              <span>All Records</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mwr-tabs">
          <button
            className={`mwr-tab ${isManure ? "active" : ""}`}
            onClick={() => handleTabChange("manure")}
          >
            <FiPackage /> Manure Record
          </button>
          <button
            className={`mwr-tab ${!isManure ? "active" : ""}`}
            onClick={() => handleTabChange("waste")}
          >
            <FiTrash2 /> Waste Record
          </button>
        </div>

        {/* Table */}
        <div className="mwr-table-wrapper">

          {/* MANURE TABLE */}
          {isManure && (
            <table className="mwr-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>BATCH ID / HOUSE NO.</th>
                  <th>QTY OF MANURE COLLECTED</th>
                  <th>METHOD OF HANDLING</th>
                  <th>STORAGE LOCATION</th>
                  <th>END USE / DISPOSAL</th>
                  <th>PERSON RESPONSIBLE</th>
                  <th>REMARKS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredManure.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="mwr-empty-state">
                      <div className="mwr-empty-content">
                        <FiMaximize />
                        <h3>No manure records found</h3>
                        <p>Click Add Manure Record to log your first entry.</p>
                        <button className="mwr-empty-add-btn" onClick={() => navigate("/records/manure/add")}>
                          <FiPlus /> Add Manure Record
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredManure.map((r) => (
                    <tr key={r._id}>
                      <td>{r.date}</td>
                      <td><span className="mwr-batch-badge">{r.batchId}</span></td>
                      <td>{r.quantityCollected}</td>
                      <td>{r.methodOfHandling}</td>
                      <td>{r.storageLocation}</td>
                      <td>{r.endUse}</td>
                      <td>{r.personResponsible}</td>
                      <td>{r.remarks || "—"}</td>
                      <td>
                        <div className="mwr-actions">
                          <button
                            className="mwr-btn-edit"
                            title="Edit"
                            onClick={() => navigate(`/records/manure/edit/${r._id}`)}
                          >
                            <FiEdit2 />
                          </button>
                          <button className="mwr-btn-archive" onClick={() => archiveRow({ module: "Manure & Waste", moduleKey: "pb_waste", record: r, name: r.type || r.date })} title="Archive">
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

          {/* WASTE TABLE */}
          {!isManure && (
            <table className="mwr-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>WASTE TYPE</th>
                  <th>QUANTITY / UNIT</th>
                  <th>DISPOSAL METHOD</th>
                  <th>PERSON RESPONSIBLE</th>
                  <th>REMARKS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredWaste.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="mwr-empty-state">
                      <div className="mwr-empty-content">
                        <FiMaximize />
                        <h3>No waste records found</h3>
                        <p>Click Add Waste Record to log your first entry.</p>
                        <button className="mwr-empty-add-btn" onClick={() => navigate("/records/waste/add")}>
                          <FiPlus /> Add Waste Record
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredWaste.map((r) => (
                    <tr key={r._id}>
                      <td>{r.date}</td>
                      <td>{r.wasteType}</td>
                      <td>{r.quantity}</td>
                      <td>{r.disposalMethod}</td>
                      <td>{r.personResponsible}</td>
                      <td>{r.remarks || "—"}</td>
                      <td>
                        <div className="mwr-actions">
                          <button
                            className="mwr-btn-edit"
                            title="Edit"
                            onClick={() => navigate(`/records/waste/edit/${r._id}`)}
                          >
                            <FiEdit2 />
                          </button>
                          <button className="mwr-btn-archive" onClick={() => archiveRow({ module: "Manure & Waste", moduleKey: "pb_waste", record: r, name: r.type || r.date })} title="Archive">
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

          <div className="mwr-table-footer">
            Showing {isManure ? filteredManure.length : filteredWaste.length} entries
          </div>
        </div>

      </div>
    </div>
  );
}
