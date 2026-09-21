import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter,
  FiEdit2, FiArchive, FiMaximize,
  FiPackage, FiTrash2, FiClipboard, FiLayers,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { useUser } from "../hooks/useUser";
import ExportMenu from "../components/ExportMenu";
import "./ManureandWasteRecord.css";
import { useArchiveConfirm } from "../hooks/useArchiveConfirm";
import ArchiveConfirmModal from "../components/ArchiveConfirmModal";
import { listWasteRecords, listManureRecords } from "../api/wasteManure";
import { getFarmInfo } from "../api/profile";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination from "../components/TablePagination";
import "../components/TablePagination.css";

export default function ManureWasteRecord() {
  const navigate = useNavigate();
  const { canEdit, canArchive } = useUser();
  const { pending: archivePending, requestArchive, cancelArchive, confirmArchive } = useArchiveConfirm();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") === "waste" ? "waste" : "manure"
  );
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const defaultFilters = { batchId: "All", category: "All", period: "all", year: "All", month: "All", week: "", dateFrom: "", dateTo: "" };
  const [filters, setFilters] = useState(defaultFilters);
  const [draft, setDraft] = useState(defaultFilters);
  const [filterApplied, setFilterApplied] = useState(false);
  const filterRef = useRef(null);
  const [farmInfo, setFarmInfo] = useState({ farmName: "", farmLocation: "", farmContact: "", farmEmail: "", farmLogo: "" });

  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [wasteData, manureData] = await Promise.all([
          listWasteRecords().catch(() => []),
          listManureRecords().catch(() => []),
        ]);
        const toList = (d) => (Array.isArray(d) ? d : d?.records || d?.data || []);
        const merged = [...toList(wasteData), ...toList(manureData)].map((r) => ({
          ...r,
          date: r.date ? String(r.date).slice(0, 10) : r.date,
        }));
        const seen = new Set();
        const deduped = merged.filter((r) => {
          const key = r._id || r.id;
          if (key && seen.has(key)) return false;
          if (key) seen.add(key);
          return true;
        });
        setAllRecords(deduped);
      } catch (err) {
        setAllRecords([]);
        setError(err?.message || "Couldn't load waste & manure records.");
      } finally {
        setLoading(false);
      }
    })();
    getFarmInfo().then((d) => setFarmInfo(d)).catch(() => {});
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

  const handleFilterChange = (key, value) => setDraft((f) => ({ ...f, [key]: value }));
  const clearFilters = () => { setDraft(defaultFilters); setFilters(defaultFilters); setFilterApplied(false); };

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const todayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

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

  const matchesDatePeriod = (r, f) => {
    if (f.period === "all") return true;
    const d = new Date(r.date);
    const recYear = isNaN(d) ? null : String(d.getFullYear());
    const recMonth = isNaN(d) ? null : MONTH_NAMES[d.getMonth()];
    if (f.period === "today") return r.date === todayStr();
    if (f.period === "week") return !!f.week && isoWeekOf(r.date) === f.week;
    if (f.period === "month") return f.year !== "All" && f.month !== "All" && recYear === f.year && recMonth === f.month;
    if (f.period === "year") return f.year !== "All" && recYear === f.year;
    if (f.period === "custom") return (!f.dateFrom || r.date >= f.dateFrom) && (!f.dateTo || r.date <= f.dateTo);
    return true;
  };

  const applyFilters = () => {
    if (draft.period === "custom") {
      const today = todayStr();
      if (draft.dateFrom && draft.dateFrom > today) { setError("Start date cannot be a future date."); return; }
      if (draft.dateTo && draft.dateTo > today) { setError("End date cannot be a future date."); return; }
      if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) { setError("Start date cannot be later than end date."); return; }
    }
    setError("");
    setFilters(draft);
    setFilterApplied(true);
    setShowFilter(false);
  };
  const openFilterPanel = () => { setDraft(filters); setShowFilter((s) => !s); };
  const activeFilterCount =
    (filterApplied && filters.period !== "all" ? 1 : 0) +
    (filterApplied && filters.batchId !== "All" ? 1 : 0) +
    (filterApplied && filters.category !== "All" ? 1 : 0);

  const yearOptions = [...new Set(
    allRecords.map((r) => { const d = new Date(r.date); return isNaN(d) ? null : String(d.getFullYear()); }).filter(Boolean)
  )].sort((a, b) => b - a);

  const monthOptions = [...new Set(
    allRecords
      .filter((r) => draft.year === "All" || String(new Date(r.date).getFullYear()) === draft.year)
      .map((r) => { const d = new Date(r.date); return isNaN(d) ? null : MONTH_NAMES[d.getMonth()]; })
      .filter(Boolean)
  )].sort((a, b) => MONTH_NAMES.indexOf(a) - MONTH_NAMES.indexOf(b));

  const filteredManure = manureRecords.filter((r) =>
    r.batchId?.toLowerCase().includes(search.toLowerCase()) &&
    (!filterApplied || (
      (filters.batchId === "All" || r.batchId === filters.batchId) &&
      (filters.category === "All" || r.methodOfHandling === filters.category) &&
      matchesDatePeriod(r, filters)
    ))
  );

  const filteredWaste = wasteRecords.filter((r) =>
    r.wasteType?.toLowerCase().includes(search.toLowerCase()) &&
    (!filterApplied || (
      (filters.category === "All" || r.wasteType === filters.category) &&
      matchesDatePeriod(r, filters)
    ))
  );

  const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
  const manureAccessor = (row, col) => {
    if (col === "date") return row.date || "";
    if (col === "batchId") return row.batchId || "";
    if (col === "quantityCollected") return Number(row.quantityCollected) || 0;
    if (col === "methodOfHandling") return row.methodOfHandling || "";
    if (col === "storageLocation") return row.storageLocation || "";
    if (col === "personResponsible") return row.personResponsible || "";
    return "";
  };
  const wasteAccessor = (row, col) => {
    if (col === "date") return row.date || "";
    if (col === "wasteType") return row.wasteType || "";
    if (col === "quantity") return Number(row.quantity) || 0;
    if (col === "disposalMethod") return row.disposalMethod || "";
    if (col === "personResponsible") return row.personResponsible || "";
    return "";
  };
  const sortedManure = sortData(filteredManure, manureAccessor);
  const sortedWaste = sortData(filteredWaste, wasteAccessor);
  const isManure = activeTab === "manure";
  const activeSorted = isManure ? sortedManure : sortedWaste;
  const pager = usePagination(activeSorted.length);
  useEffect(() => { pager.setPage(1); }, [search, filterApplied, filters, activeTab]);
  const pageManure = sortedManure.slice(pager.startIndex, pager.endIndex);
  const pageWaste = sortedWaste.slice(pager.startIndex, pager.endIndex);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearch("");
    setDraft(defaultFilters);
    setFilters(defaultFilters);
    setFilterApplied(false);
    setShowFilter(false);
  };

  const uniq = (vals) => [...new Set(vals.filter(Boolean))];
  const categoryLabel = isManure ? "Method of Handling" : "Waste Type";
  const categoryOptions = isManure
    ? uniq(manureRecords.map((r) => r.methodOfHandling))
    : uniq(wasteRecords.map((r) => r.wasteType));
  const batchOptions = uniq(manureRecords.map((r) => r.batchId));

  const totalManure = filteredManure.length;
  const totalWaste = filteredWaste.length;
  const totalCollected = filteredManure.reduce(
    (sum, r) => sum + (Number(r.quantityCollected) || 0), 0
  );

  const statCardSpanLabel = (() => {
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

  const periodLabel = statCardSpanLabel;

  const farmMeta = {
    farmName: farmInfo.farmName,
    location: farmInfo.farmLocation,
    contact: farmInfo.farmContact,
    email: farmInfo.farmEmail,
    logoUrl: farmInfo.farmLogo
      ? (farmInfo.farmLogo.startsWith("http") ? farmInfo.farmLogo : `http://localhost:5000${farmInfo.farmLogo}`)
      : "",
    period: periodLabel,
    fields: [
      ...(isManure && filters.batchId !== "All" ? [{ label: "Batch ID", value: filters.batchId }] : []),
      ...(filters.category !== "All" ? [{ label: categoryLabel, value: filters.category }] : []),
    ],
  };

  const exportTitle = isManure ? "Manure Collection Report" : "Waste Management Report";
  const exportSummary = isManure
    ? [
        { label: "Manure Records", value: String(totalManure) },
        { label: "Manure Collected", value: `${totalCollected} kg` },
      ]
    : [
        { label: "Waste Records", value: String(totalWaste) },
      ];

  const manureExportColumns = [
    { key: "date", label: "Date" },
    { key: "batchId", label: "Batch ID / House No." },
    { key: "quantityCollected", label: "Qty of Manure Collected" },
    { key: "methodOfHandling", label: "Method of Handling" },
    { key: "storageLocation", label: "Storage Location" },
    { key: "endUse", label: "End Use / Disposal" },
    { key: "personResponsible", label: "Person Responsible" },
    { key: "remarks", label: "Remarks" },
  ];
  const wasteExportColumns = [
    { key: "date", label: "Date" },
    { key: "wasteType", label: "Waste Type" },
    { key: "quantity", label: "Quantity / Unit" },
    { key: "disposalMethod", label: "Disposal Method" },
    { key: "personResponsible", label: "Person Responsible" },
    { key: "remarks", label: "Remarks" },
  ];
  const manureExportRows = filteredManure.map((r) => ({
    date: r.date ? new Date(r.date).toISOString().split("T")[0] : "—",
    batchId: r.batchId || "—",
    quantityCollected: r.quantityCollected ?? "—",
    methodOfHandling: r.methodOfHandling || "—",
    storageLocation: r.storageLocation || "—",
    endUse: r.endUse || "—",
    personResponsible: r.personResponsible || "—",
    remarks: r.remarks || "—",
  }));
  const wasteExportRows = filteredWaste.map((r) => ({
    date: r.date ? new Date(r.date).toISOString().split("T")[0] : "—",
    wasteType: r.wasteType || "—",
    quantity: r.quantity ?? "—",
    disposalMethod: r.disposalMethod || "—",
    personResponsible: r.personResponsible || "—",
    remarks: r.remarks || "—",
  }));
  const exportColumns = isManure ? manureExportColumns : wasteExportColumns;
  const exportRows = isManure ? manureExportRows : wasteExportRows;

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "RECORDS", path: "/records" },
        { label: "MANURE AND WASTE RECORD" },
      ]}
    >

        {}
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
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="mwr-btn-group">
              <div className="mwr-filter-wrap" ref={filterRef}>
                <button className="mwr-toolbar-btn" onClick={openFilterPanel}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="mwr-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="mwr-filter-dropdown">
                    <div className="mwr-filter-dropdown-header">
                      <span>Filter {isManure ? "Manure" : "Waste"} Records</span>
                    </div>

                    <div className="mwr-filter-section-label">Date Filter</div>
                    <div className="mwr-filter-row">
                      <div className="mwr-filter-group">
                        <label className="mwr-filter-label">Date Period</label>
                        <select
                          className="mwr-filter-select"
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
                        <div className="mwr-filter-group">
                          <label className="mwr-filter-label">Week</label>
                          <input
                            type="week"
                            className="mwr-filter-select"
                            value={draft.week}
                            onChange={(e) => handleFilterChange("week", e.target.value)}
                          />
                        </div>
                      )}

                      {draft.period === "month" && (
                        <div className="mwr-filter-group">
                          <label className="mwr-filter-label">Month</label>
                          <select
                            className="mwr-filter-select"
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
                        <div className="mwr-filter-group">
                          <label className="mwr-filter-label">Year</label>
                          <select
                            className="mwr-filter-select"
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
                      <div className="mwr-filter-group">
                        <label className="mwr-filter-label">Start Date / End Date</label>
                        <div className="mwr-filter-date-range">
                          <input type="date" className="mwr-filter-select" value={draft.dateFrom}
                            max={draft.dateTo || todayStr()}
                            onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label="From date" />
                          <span>to</span>
                          <input type="date" className="mwr-filter-select" value={draft.dateTo}
                            min={draft.dateFrom || undefined} max={todayStr()}
                            onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label="To date" />
                        </div>
                      </div>
                    )}

                    <div className="mwr-filter-section-label">Filters</div>
                    {isManure && (
                      <div className="mwr-filter-group">
                        <label className="mwr-filter-label">Batch ID</label>
                        <select
                          className="mwr-filter-select"
                          value={draft.batchId}
                          onChange={(e) => handleFilterChange("batchId", e.target.value)}
                        >
                          <option value="All">All Batches</option>
                          {batchOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="mwr-filter-group">
                      <label className="mwr-filter-label">{categoryLabel}</label>
                      <select
                        className="mwr-filter-select"
                        value={draft.category}
                        onChange={(e) => handleFilterChange("category", e.target.value)}
                      >
                        <option value="All">All</option>
                        {categoryOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mwr-filter-actions">
                      <button className="mwr-filter-clear" onClick={clearFilters}>Clear All</button>
                      <button className="mwr-filter-apply" onClick={applyFilters}>Apply</button>
                    </div>
                  </div>
                )}
              </div>

              <ExportMenu
                rows={exportRows}
                columns={exportColumns}
                name={isManure ? "manure-record" : "waste-record"}
                title={exportTitle}
                meta={farmMeta}
                pdfExtra={{ period: farmMeta.period, summary: exportSummary }}
                moduleLabel={isManure ? "Manure & Waste — Manure" : "Manure & Waste — Waste"}
                enablePreview
                filters={{
                  ...(isManure && filters.batchId !== "All" ? { "Batch ID": filters.batchId } : {}),
                  ...(filters.category !== "All" ? { [categoryLabel]: filters.category } : {}),
                  ...(filterApplied && filters.period !== "all" ? { "Report Period": periodLabel } : {}),
                }}
                className="mwr-toolbar-btn"
              />
            </div>
          </div>
        </div>

        {error && <div className="mwr-active-filters" style={{ color: "#d94f4f" }}>{error}</div>}

        <div className="mwr-stats-grid">
          <div className="mwr-stat-card">
            <div className="mwr-stat-icon gold"><FiClipboard /></div>
            <div>
              <h3>{totalManure + totalWaste}</h3>
              <p>Total Records</p>
              <span>{statCardSpanLabel}</span>
            </div>
          </div>
          <div className="mwr-stat-card">
            <div className="mwr-stat-icon blue"><FiPackage /></div>
            <div>
              <h3>{totalManure}</h3>
              <p>Manure Records</p>
              <span>{statCardSpanLabel}</span>
            </div>
          </div>
          <div className="mwr-stat-card">
            <div className="mwr-stat-icon red"><FiTrash2 /></div>
            <div>
              <h3>{totalWaste}</h3>
              <p>Waste Records</p>
              <span>{statCardSpanLabel}</span>
            </div>
          </div>
          <div className="mwr-stat-card">
            <div className="mwr-stat-icon green"><FiLayers /></div>
            <div>
              <h3>{totalCollected} kg</h3>
              <p>Manure Collected</p>
              <span>{statCardSpanLabel}</span>
            </div>
          </div>
        </div>

        {}
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

        {}
        <div className="mwr-table-wrapper">

          {}
          {isManure && (
            <table className="mwr-table">
              <thead>
                <tr>
                  <th className="mwr-sortable-th" onClick={() => cycleSort("date")}>DATE{sortIndicator("date", sortColumn, sortDirection)}</th>
                  <th className="mwr-sortable-th" onClick={() => cycleSort("batchId")}>BATCH ID / HOUSE NO.{sortIndicator("batchId", sortColumn, sortDirection)}</th>
                  <th className="mwr-sortable-th" onClick={() => cycleSort("quantityCollected")}>QTY OF MANURE COLLECTED{sortIndicator("quantityCollected", sortColumn, sortDirection)}</th>
                  <th className="mwr-sortable-th" onClick={() => cycleSort("methodOfHandling")}>METHOD OF HANDLING{sortIndicator("methodOfHandling", sortColumn, sortDirection)}</th>
                  <th className="mwr-sortable-th" onClick={() => cycleSort("storageLocation")}>STORAGE LOCATION{sortIndicator("storageLocation", sortColumn, sortDirection)}</th>
                  <th>END USE / DISPOSAL</th>
                  <th className="mwr-sortable-th" onClick={() => cycleSort("personResponsible")}>PERSON RESPONSIBLE{sortIndicator("personResponsible", sortColumn, sortDirection)}</th>
                  <th>REMARKS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="9" className="mwr-empty-state">Loading manure records...</td></tr>
                ) : filteredManure.length === 0 && manureRecords.length > 0 ? (
                  <tr>
                    <td colSpan="9" className="mwr-empty-state">
                      <div className="mwr-empty-content">
                        <FiMaximize />
                        <h3>No manure and waste records found</h3>
                        <p>No matching manure records were found for your search.</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredManure.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="mwr-empty-state">
                      <div className="mwr-empty-content">
                        <FiMaximize />
                        <h3>No manure and waste records found</h3>
                        <p>Click Add Manure Record to log your first entry.</p>
                        <button className="mwr-empty-add-btn" onClick={() => navigate("/records/manure/add")}>
                          <FiPlus /> Add Manure Record
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageManure.map((r) => (
                    <tr key={r._id}>
                      <td>{r.date ? new Date(r.date).toISOString().split("T")[0] : ""}</td>
                      <td><span className="mwr-batch-badge">{r.batchId}</span></td>
                      <td>{r.quantityCollected}</td>
                      <td>{r.methodOfHandling}</td>
                      <td>{r.storageLocation}</td>
                      <td>{r.endUse}</td>
                      <td>{r.personResponsible}</td>
                      <td>{r.remarks || "—"}</td>
                      <td>
                        <div className="mwr-actions">
                          {canEdit && (
                          <button
                            className="mwr-btn-edit"
                            title="Edit"
                            onClick={() => navigate(`/records/manure/edit/${r._id}`)}
                          >
                            <FiEdit2 />
                          </button>
                          )}
                          {canArchive && (
                          <button className="mwr-btn-archive" onClick={() => requestArchive({ module: "Manure & Waste", moduleKey: "pb_waste", record: r, name: r.type || r.date })} title="Archive">
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
          )}

          {}
          {!isManure && (
            <table className="mwr-table">
              <thead>
                <tr>
                  <th className="mwr-sortable-th" onClick={() => cycleSort("date")}>DATE{sortIndicator("date", sortColumn, sortDirection)}</th>
                  <th className="mwr-sortable-th" onClick={() => cycleSort("wasteType")}>WASTE TYPE{sortIndicator("wasteType", sortColumn, sortDirection)}</th>
                  <th className="mwr-sortable-th" onClick={() => cycleSort("quantity")}>QUANTITY / UNIT{sortIndicator("quantity", sortColumn, sortDirection)}</th>
                  <th className="mwr-sortable-th" onClick={() => cycleSort("disposalMethod")}>DISPOSAL METHOD{sortIndicator("disposalMethod", sortColumn, sortDirection)}</th>
                  <th className="mwr-sortable-th" onClick={() => cycleSort("personResponsible")}>PERSON RESPONSIBLE{sortIndicator("personResponsible", sortColumn, sortDirection)}</th>
                  <th>REMARKS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="mwr-empty-state">Loading waste records...</td></tr>
                ) : filteredWaste.length === 0 && wasteRecords.length > 0 ? (
                  <tr>
                    <td colSpan="7" className="mwr-empty-state">
                      <div className="mwr-empty-content">
                        <FiMaximize />
                        <h3>No manure and waste records found</h3>
                        <p>No matching waste records were found for your search.</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredWaste.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="mwr-empty-state">
                      <div className="mwr-empty-content">
                        <FiMaximize />
                        <h3>No manure and waste records found</h3>
                        <p>Click Add Waste Record to log your first entry.</p>
                        <button className="mwr-empty-add-btn" onClick={() => navigate("/records/waste/add")}>
                          <FiPlus /> Add Waste Record
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageWaste.map((r) => (
                    <tr key={r._id}>
                      <td>{r.date ? new Date(r.date).toISOString().split("T")[0] : ""}</td>
                      <td>{r.wasteType}</td>
                      <td>{r.quantity}</td>
                      <td>{r.disposalMethod}</td>
                      <td>{r.personResponsible}</td>
                      <td>{r.remarks || "—"}</td>
                      <td>
                        <div className="mwr-actions">
                          {canEdit && (
                          <button
                            className="mwr-btn-edit"
                            title="Edit"
                            onClick={() => navigate(`/records/waste/edit/${r._id}`)}
                          >
                            <FiEdit2 />
                          </button>
                          )}
                          {canArchive && (
                          <button className="mwr-btn-archive" onClick={() => requestArchive({ module: "Manure & Waste", moduleKey: "pb_waste", record: r, name: r.type || r.date })} title="Archive">
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
          )}

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