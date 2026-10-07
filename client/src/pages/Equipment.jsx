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
  const defaultFilters = { condition: "All", period: "all", year: "All", month: "All", week: "", dateFrom: "", dateTo: "" };
  const [filters, setFilters] = useState(defaultFilters);
  const [draft, setDraft] = useState(defaultFilters);
  const [filterApplied, setFilterApplied] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    const handle = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const handleFilterChange = (key, value) => setDraft((f) => ({ ...f, [key]: value }));
  const clearFilters = () => { setDraft(defaultFilters); setFilters(defaultFilters); setFilterApplied(false); };
  const applyFilters = () => {
    if (draft.period === "custom") {
      const today = todayStr();
      if (draft.dateFrom && draft.dateFrom > today) {
        setError("Start date cannot be a future date.");
        return;
      }
      if (draft.dateTo && draft.dateTo > today) {
        setError("End date cannot be a future date.");
        return;
      }
      if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) {
        setError("Start date cannot be later than end date.");
        return;
      }
    }
    setError("");
    setFilters(draft);
    setFilterApplied(true);
    setShowFilter(false);
  };
  const openFilterPanel = () => { setDraft(filters); setShowFilter((s) => !s); };
  const activeFilterCount =
    (filterApplied && filters.period !== "all" ? 1 : 0) +
    (filterApplied && filters.condition !== "All" ? 1 : 0);

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const todayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  // Equipment dates arrive as full ISO timestamps; the Date Filter compares
  // calendar dates ("YYYY-MM-DD"), same as Flock Profile.
  const acquiredDate = (r) => (r.dateAcquired ? String(r.dateAcquired).slice(0, 10) : "");

  const isoWeekOf = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayNum = (target.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNum + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
    return `${target.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  };

  const yearOptions = [...new Set(
    records.map((r) => { const d = new Date(acquiredDate(r)); return isNaN(d) ? null : String(d.getFullYear()); }).filter(Boolean)
  )].sort((a, b) => b - a);

  const monthOptions = [...new Set(
    records
      .filter((r) => draft.year === "All" || String(new Date(acquiredDate(r)).getFullYear()) === draft.year)
      .map((r) => { const d = new Date(acquiredDate(r)); return isNaN(d) ? null : MONTH_NAMES[d.getMonth()]; })
      .filter(Boolean)
  )].sort((a, b) => MONTH_NAMES.indexOf(a) - MONTH_NAMES.indexOf(b));

  const matchesDatePeriod = (r, f) => {
    if (f.period === "all") return true;
    const date = acquiredDate(r);
    const d = new Date(date);
    const recYear = isNaN(d) ? null : String(d.getFullYear());
    const recMonth = isNaN(d) ? null : MONTH_NAMES[d.getMonth()];
    if (f.period === "today") return date === todayStr();
    if (f.period === "week") return !!f.week && isoWeekOf(date) === f.week;
    if (f.period === "month") return f.year !== "All" && f.month !== "All" && recYear === f.year && recMonth === f.month;
    if (f.period === "year") return f.year !== "All" && recYear === f.year;
    if (f.period === "custom") return (!f.dateFrom || date >= f.dateFrom) && (!f.dateTo || date <= f.dateTo);
    return true;
  };

  const filtered = records.filter((r) => {
    const matchSearch =
      r.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.itemNo?.toLowerCase().includes(search.toLowerCase());
    const matchCondition = !filterApplied || filters.condition === "All" || r.condition === filters.condition;
    const matchDate = !filterApplied || matchesDatePeriod(r, filters);
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
  useEffect(() => { pager.setPage(1); }, [search, filterApplied, filters]);
  const pageRows = sorted.slice(pager.startIndex, pager.endIndex);

  const totalItems = filtered.length;
  const totalQuantity = filtered.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const totalValue = filtered.reduce((s, r) => s + (Number(r.cost) || 0), 0);
  const inUseCount = filtered.filter((r) => r.condition === "In Use").length;

  const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;

  const periodLabel = (() => {
    if (!filterApplied || filters.period === "all") return "All Records";
    if (filters.period === "today") return "Today";
    if (filters.period === "week" && filters.week) return filters.week;
    if (filters.period === "month" && filters.month !== "All" && filters.year !== "All") return `${filters.month} ${filters.year}`;
    if (filters.period === "year" && filters.year !== "All") {
      return filters.year === String(new Date().getFullYear()) ? "This Year" : `Year ${filters.year}`;
    }
    if (filters.period === "custom" && (filters.dateFrom || filters.dateTo)) {
      return `${filters.dateFrom || "—"} – ${filters.dateTo || "—"}`;
    }
    return "All Records";
  })();

  const exportMeta = {
    farmName: farmInfo.farmName,
    location: farmInfo.farmLocation,
    contact: farmInfo.farmContact,
    email: farmInfo.farmEmail,
    logoUrl: farmInfo.farmLogo
      ? (farmInfo.farmLogo.startsWith("http") ? farmInfo.farmLogo : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${farmInfo.farmLogo}`)
      : "",
    period: periodLabel,
    fields: filterApplied && filters.condition !== "All" ? [{ label: "Condition", value: filters.condition }] : [],
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
                <button className="eq-toolbar-btn" onClick={openFilterPanel}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="eq-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="eq-filter-dropdown">
                    <div className="eq-filter-dropdown-header">
                      <span>Filter Records</span>
                    </div>

                    <div className="eq-filter-section-label">Date Filter</div>
                    <div className="eq-filter-row">
                      <div className="eq-filter-group">
                        <label className="eq-filter-label">Date Period</label>
                        <select
                          className="eq-filter-select"
                          value={draft.period}
                          onChange={(e) => handleFilterChange("period", e.target.value)}
                        >
                          <option value="all">All Records</option>
                          <option value="today">Today</option>
                          <option value="week">Week</option>
                          <option value="month">Month</option>
                          <option value="year">Year</option>
                          <option value="custom">Custom Range</option>
                        </select>
                      </div>

                      {draft.period === "week" && (
                        <div className="eq-filter-group">
                          <label className="eq-filter-label">Week</label>
                          <input
                            type="week"
                            className="eq-filter-select"
                            value={draft.week}
                            onChange={(e) => handleFilterChange("week", e.target.value)}
                          />
                        </div>
                      )}

                      {draft.period === "month" && (
                        <div className="eq-filter-group">
                          <label className="eq-filter-label">Month</label>
                          <select
                            className="eq-filter-select"
                            value={draft.month}
                            onChange={(e) => handleFilterChange("month", e.target.value)}
                          >
                            <option value="All">Select Month</option>
                            {monthOptions.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {(draft.period === "month" || draft.period === "year") && (
                        <div className="eq-filter-group">
                          <label className="eq-filter-label">Year</label>
                          <select
                            className="eq-filter-select"
                            value={draft.year}
                            onChange={(e) => handleFilterChange("year", e.target.value)}
                          >
                            <option value="All">Select Year</option>
                            {yearOptions.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {draft.period === "custom" && (
                      <div className="eq-filter-group">
                        <label className="eq-filter-label">Start Date / End Date</label>
                        <div className="eq-filter-date-range">
                          <input type="date" className="eq-filter-select" value={draft.dateFrom}
                            max={draft.dateTo || todayStr()}
                            onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label="From date" />
                          <span>to</span>
                          <input type="date" className="eq-filter-select" value={draft.dateTo}
                            min={draft.dateFrom || undefined} max={todayStr()}
                            onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label="To date" />
                        </div>
                      </div>
                    )}

                    <div className="eq-filter-section-label">Filters</div>
                    <div className="eq-filter-row">
                      <div className="eq-filter-group">
                        <label className="eq-filter-label">Condition</label>
                        <select
                          className="eq-filter-select"
                          value={draft.condition}
                          onChange={(e) => handleFilterChange("condition", e.target.value)}
                        >
                          <option value="All">All Conditions</option>
                          {CONDITION_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="eq-filter-actions">
                      <button className="eq-filter-clear" onClick={clearFilters}>Clear All</button>
                      <button className="eq-filter-apply" onClick={applyFilters}>Apply</button>
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
                  ...(filterApplied && filters.condition !== "All" ? { "Condition": filters.condition } : {}),
                  ...(filterApplied && filters.period !== "all" ? { "Report Period": periodLabel } : {}),
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
            {filters.condition !== "All" && (
              <span className="eq-active-filter-tag">
                Condition: {filters.condition}
                <button onClick={() => { const next = { ...filters, condition: "All" }; setFilters(next); setDraft(next); }}>✕</button>
              </span>
            )}
            {filters.period !== "all" && (
              <span className="eq-active-filter-tag">
                Date: {periodLabel}
                <button onClick={() => { const next = { ...filters, period: "all", year: "All", month: "All", week: "", dateFrom: "", dateTo: "" }; setFilters(next); setDraft(next); }}>✕</button>
              </span>
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