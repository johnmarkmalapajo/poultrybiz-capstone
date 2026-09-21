import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiEdit2, FiArchive,
  FiGrid, FiPackage, FiDollarSign, FiCheckCircle, FiMaximize,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import ExportMenu from "../components/ExportMenu";
import { useUser } from "../hooks/useUser";
import "./Equipment.css";
import { useArchiveConfirm } from "../hooks/useArchiveConfirm";
import ArchiveConfirmModal from "../components/ArchiveConfirmModal";
import { listEquipment } from "../api/equipmentTools";
import { getFarmInfo } from "../api/profile";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination from "../components/TablePagination";
import "../components/TablePagination.css";

const CONDITION_OPTIONS = ["In Use", "Idle", "For Repair", "For Disposal"];

export default function Equipment() {
  const navigate = useNavigate();
  const { canEdit, canArchive, canSeeFinancials, isOwner } = useUser();
  const { pending: archivePending, requestArchive, cancelArchive, confirmArchive } = useArchiveConfirm();
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [farmInfo, setFarmInfo] = useState({ farmName: "", farmLocation: "", farmContact: "", farmEmail: "", farmLogo: "" });
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await listEquipment();
        setRecords(Array.isArray(data) ? data : data.records || data.data || []);
      } catch (err) {
        setRecords([]);
        setError(err?.message || "Couldn't load equipment records.");
      } finally {
        setLoading(false);
      }
    })();
    getFarmInfo().then((d) => setFarmInfo(d)).catch(() => {});
  }, []);

  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ condition: "All", dateFrom: "", dateTo: "" });
  const filterRef = useRef(null);

  useEffect(() => {
    const handle = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({ condition: "All", dateFrom: "", dateTo: "" });
  const activeFilterCount = Object.entries(filters).filter(([, v]) => v && v !== "All").length;

  const filtered = records.filter((r) => {
    const matchSearch =
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.itemNo?.toLowerCase().includes(search.toLowerCase());
    const matchCondition = filters.condition === "All" || r.condition === filters.condition;
    const matchDate =
      (!filters.dateFrom || (r.dateAcquired || "") >= filters.dateFrom) &&
      (!filters.dateTo || (r.dateAcquired || "") <= filters.dateTo);
    return matchSearch && matchCondition && matchDate;
  });

  const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
  const sortAccessor = (row, col) => {
    if (col === "itemNo") return row.itemNo || "";
    if (col === "name") return row.name || "";
    if (col === "serialNo") return row.serialNo || "";
    if (col === "quantity") return Number(row.quantity) || 0;
    if (col === "unit") return row.unit || "";
    if (col === "condition") return row.condition || "";
    if (col === "location") return row.location || "";
    if (col === "custodian") return row.custodian || "";
    if (col === "dateAcquired") return row.dateAcquired || "";
    if (col === "cost") return Number(row.cost) || 0;
    return "";
  };
  const sorted = sortData(filtered, sortAccessor);
  const pager = usePagination(sorted.length);
  useEffect(() => { pager.setPage(1); }, [search, filters]);
  const pageRows = sorted.slice(pager.startIndex, pager.endIndex);

  const totalItems = filtered.length;
  const totalQuantity = filtered.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const totalValue = filtered.reduce((s, r) => s + (Number(r.cost) || 0), 0);
  const inUseCount = filtered.filter((r) => r.condition === "In Use").length;

  const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;

  const periodLabel = filters.dateFrom && filters.dateTo
    ? `${filters.dateFrom} – ${filters.dateTo}`
    : filters.dateFrom
      ? `From ${filters.dateFrom}`
      : filters.dateTo
        ? `Until ${filters.dateTo}`
        : "All Time";

  const exportMeta = {
    farmName: farmInfo.farmName,
    location: farmInfo.farmLocation,
    contact: farmInfo.farmContact,
    email: farmInfo.farmEmail,
    logoUrl: farmInfo.farmLogo
      ? (farmInfo.farmLogo.startsWith("http") ? farmInfo.farmLogo : `http://localhost:5000${farmInfo.farmLogo}`)
      : "",
    period: periodLabel,
    fields: filters.condition !== "All" ? [{ label: "Condition", value: filters.condition }] : [],
  };

  const exportSummary = filtered.length
    ? [
        { label: "Total Items", value: String(totalItems) },
        { label: "Total Quantity", value: String(totalQuantity) },
        ...(canSeeFinancials ? [{ label: "Total Value", value: peso(totalValue) }] : []),
        { label: "In Use", value: String(inUseCount) },
      ]
    : [];

  const exportColumns = [
    { key: "itemNo", label: "Item No." },
    { key: "name", label: "Equipment/Tool Name" },
    { key: "description", label: "Description/Specifications" },
    { key: "serialNo", label: "Serial/ID No." },
    { key: "quantity", label: "Quantity" },
    { key: "unit", label: "Unit" },
    { key: "condition", label: "Condition" },
    { key: "location", label: "Location/Storage" },
    { key: "custodian", label: "Custodian/Assigned To" },
    { key: "dateAcquired", label: "Date Acquired" },
    ...(canSeeFinancials ? [{ key: "cost", label: "Acquisition Cost" }] : []),
    { key: "remarks", label: "Remarks" },
  ];

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "INVENTORY", path: "/inventory" },
        { label: "EQUIPMENT & TOOLS RECORD" },
      ]}
    >

        <div className="eq-toolbar">
          {isOwner && (
            <button className="eq-add-btn" onClick={() => navigate("/sales-transactions/expenses/add?category=Equipment")}>
              <FiPlus />
              Add Equipment
            </button>
          )}

          <div className="eq-toolbar-right">
            <div className="eq-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="eq-btn-group">
              {}
              <div className="eq-filter-wrap" ref={filterRef}>
                <button className="eq-toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
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

                    <div className="eq-filter-group">
                      <label className="eq-filter-label">Report Period</label>
                      <div className="eq-filter-date-range">
                        <input type="date" className="eq-filter-select" value={filters.dateFrom}
                          onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label="From date" />
                        <span>to</span>
                        <input type="date" className="eq-filter-select" value={filters.dateTo}
                          onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label="To date" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <ExportMenu
                rows={filtered}
                columns={exportColumns}
                name="equipment-tools"
                title="Equipment & Tools Report"
                meta={exportMeta}
                pdfExtra={{ period: exportMeta.period, summary: exportSummary }}
                moduleLabel="Equipment & Tools"
                enablePreview
                filters={{
                  ...(filters.condition !== "All" ? { "Condition": filters.condition } : {}),
                  ...(periodLabel !== "All Time" ? { "Report Period": periodLabel } : {}),
                }}
                className="eq-toolbar-btn"
              />
            </div>
          </div>
        </div>

        {error && <div className="eq-active-filters" style={{ color: "#d94f4f" }}>{error}</div>}

        {}
        {activeFilterCount > 0 && (
          <div className="eq-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value !== "All" ? (
                <span key={key} className="eq-active-filter-tag">
                  {key === "condition" ? "Condition" : key === "dateFrom" ? "From" : key === "dateTo" ? "To" : key}: {value}
                  <button onClick={() => handleFilterChange(key, key === "dateFrom" || key === "dateTo" ? "" : "All")}>✕</button>
                </span>
              ) : null
            )}
          </div>
        )}

        <div className="eq-stats-grid">
          <div className="eq-stat-card">
            <div className="eq-stat-icon gold"><FiGrid /></div>
            <div>
              <h3>{totalItems}</h3>
              <p>Total Items</p>
              <span>All Records</span>
            </div>
          </div>

          <div className="eq-stat-card">
            <div className="eq-stat-icon blue"><FiPackage /></div>
            <div>
              <h3>{totalQuantity}</h3>
              <p>Total Quantity</p>
              <span>All Units</span>
            </div>
          </div>

          {canSeeFinancials && (
            <div className="eq-stat-card">
              <div className="eq-stat-icon green"><FiDollarSign /></div>
              <div>
                <h3>{peso(totalValue)}</h3>
                <p>Total Value</p>
                <span>Acquisition Cost</span>
              </div>
            </div>
          )}

          <div className="eq-stat-card">
            <div className="eq-stat-icon green"><FiCheckCircle /></div>
            <div>
              <h3>{inUseCount}</h3>
              <p>In Use</p>
              <span>Items</span>
            </div>
          </div>
        </div>

        <div className="eq-table-wrapper">
          <table className="eq-table">
            <thead>
              <tr>
                <th className="eq-sortable-th" onClick={() => cycleSort("itemNo")}>Item No.{sortIndicator("itemNo", sortColumn, sortDirection)}</th>
                <th className="eq-sortable-th" onClick={() => cycleSort("name")}>Equipment/Tool Name{sortIndicator("name", sortColumn, sortDirection)}</th>
                <th>Description/Specifications</th>
                <th className="eq-sortable-th" onClick={() => cycleSort("serialNo")}>Serial/ID No.{sortIndicator("serialNo", sortColumn, sortDirection)}</th>
                <th className="eq-sortable-th" onClick={() => cycleSort("quantity")}>Quantity{sortIndicator("quantity", sortColumn, sortDirection)}</th>
                <th className="eq-sortable-th" onClick={() => cycleSort("unit")}>Unit{sortIndicator("unit", sortColumn, sortDirection)}</th>
                <th className="eq-sortable-th" onClick={() => cycleSort("condition")}>Condition{sortIndicator("condition", sortColumn, sortDirection)}</th>
                <th className="eq-sortable-th" onClick={() => cycleSort("location")}>Location/Storage{sortIndicator("location", sortColumn, sortDirection)}</th>
                <th className="eq-sortable-th" onClick={() => cycleSort("custodian")}>Custodian/Assigned To{sortIndicator("custodian", sortColumn, sortDirection)}</th>
                <th className="eq-sortable-th" onClick={() => cycleSort("dateAcquired")}>Date Acquired{sortIndicator("dateAcquired", sortColumn, sortDirection)}</th>
                {canSeeFinancials && <th className="eq-sortable-th" onClick={() => cycleSort("cost")}>Acquisition Cost{sortIndicator("cost", sortColumn, sortDirection)}</th>}
                <th>Remarks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canSeeFinancials ? 13 : 12} className="eq-empty-state">Loading equipment records...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canSeeFinancials ? 13 : 12} className="eq-empty-state">
                    <div className="eq-empty-content">
                      <FiMaximize />
                      <h3>No equipment records found</h3>
                      <p>{isOwner ? "Click Add Equipment to record your first item." : "No equipment records to display."}</p>
                      {isOwner && (
                        <button className="eq-empty-add-btn" onClick={() => navigate("/sales-transactions/expenses/add?category=Equipment")}>
                          <FiPlus />
                          Add Equipment
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r._id || r.id}>
                    <td className="eq-item-no">{r.itemNo}</td>
                    <td>{r.name}</td>
                    <td className="eq-desc">{r.description}</td>
                    <td>{r.serialNo}</td>
                    <td>{r.quantity}</td>
                    <td>{r.unit}</td>
                    <td>
                      <span className={`eq-condition ${r.condition ? r.condition.toLowerCase().replace(/\s+/g, "-") : ""}`}>{r.condition}</span>
                    </td>
                    <td>{r.location}</td>
                    <td>{r.custodian}</td>
                    <td>{r.dateAcquired  ? new Date(r.dateAcquired).toISOString().split("T")[0]: ""}</td>
                    {canSeeFinancials && <td>{peso(r.cost)}</td>}
                    <td>{r.remarks}</td>
                    <td>
                      <div className="eq-actions">
                        {canEdit && (
                          <button
                            className="eq-btn-edit"
                            title="Edit"
                            onClick={() => navigate(`/inventory/equipment/edit/${r._id || r.id}`)}
                          >
                            <FiEdit2 />
                          </button>
                        )}
                        {canArchive && (
                          <button className="eq-btn-archive" onClick={() => requestArchive({ module: "Equipment & Tools", moduleKey: "pb_equipment", record: r, name: r.name || r.equipmentName })} title="Archive">
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

          <TablePagination
            page={pager.page}
            setPage={pager.setPage}
            rowsPerPage={pager.rowsPerPage}
            setRowsPerPage={pager.setRowsPerPage}
            totalPages={pager.totalPages}
            startIndex={pager.startIndex}
            endIndex={pager.endIndex}
            totalItems={pager.totalItems}
          />
        </div>

      <ArchiveConfirmModal pending={archivePending} onCancel={cancelArchive} onConfirm={confirmArchive} />

    </PageLayout>
  );
}