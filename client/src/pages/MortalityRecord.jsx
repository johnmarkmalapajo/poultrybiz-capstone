import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload,
  FiEdit2, FiArchive, FiMaximize,
  FiHeart, FiFileText, FiAlertCircle,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import ExportMenu from "../components/ExportMenu";
import { useUser } from "../hooks/useUser";
import "./MortalityRecord.css";
import { archiveRow } from "../archiveRow";
import { useArchiveConfirm } from "../hooks/useArchiveConfirm";
import ArchiveConfirmModal from "../components/ArchiveConfirmModal";
import { listMortalityRecords } from "../api/mortalityRecord";
import { getFarmInfo } from "../api/profile";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination from "../components/TablePagination";
import "../components/TablePagination.css";

export default function MortalityRecord() {
  const navigate = useNavigate();
  const { canEdit, canArchive } = useUser();
  const { pending: archivePending, requestArchive, cancelArchive, confirmArchive } = useArchiveConfirm();
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const defaultFilters = { batchId: "All", period: "all", year: "All", month: "All", week: "", dateFrom: "", dateTo: "" };
  const [filters, setFilters] = useState(defaultFilters);
  const [draft, setDraft] = useState(defaultFilters);
  const [filterApplied, setFilterApplied] = useState(false);
  const [filterError, setFilterError] = useState("");
  const filterRef = useRef(null);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewRecord, setViewRecord] = useState(null);
  const [farmInfo, setFarmInfo] = useState({ farmName: "", farmLocation: "", farmContact: "", farmEmail: "", farmLogo: "" });

  const renderRemarksCell = (record, text) => {
    if (!text) return "—";
    if (text.length <= 15) return text;
    return (
      <button type="button" className="mr-view-remarks-link" onClick={() => setViewRecord(record)}>
        View Remarks
      </button>
    );
  };

  useEffect(() => {
    setLoading(true);
    listMortalityRecords()
      .then((d) => {
        const list = Array.isArray(d) ? d : d.records || d.data || [];
        setRecords(list.map((r) => ({ ...r, date: r.date ? String(r.date).slice(0, 10) : r.date })));
      })
      .catch((err) => { setRecords([]); setError(err?.message || "Couldn't load mortality records."); })
      .finally(() => setLoading(false));
    getFarmInfo().then((d) => setFarmInfo(d)).catch(() => {});
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const pad2 = (n) => String(n).padStart(2, "0");

  const todayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  };

  // Records are stored as calendar dates ("YYYY-MM-DD"). Read the parts
  // straight from the string so no timezone conversion can shift a record
  // into the previous/next day, month, or year.
  const dateParts = (dateStr) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ""));
    return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
  };

  // ISO-8601 week ("YYYY-Www") — same format as <input type="week">.
  const isoWeekOf = (dateStr) => {
    const p = dateParts(dateStr);
    if (!p) return "";
    const t = new Date(Date.UTC(p.y, p.m - 1, p.d));
    const dayNum = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
    return `${t.getUTCFullYear()}-W${pad2(weekNum)}`;
  };

  const currentYear = () => String(new Date().getFullYear());
  const currentMonth = () => MONTH_NAMES[new Date().getMonth()];

  const matchesDatePeriod = (r, f) => {
    if (f.period === "all") return true;
    const p = dateParts(r.date);
    if (!p) return false;
    const recDate = `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
    const recYear = String(p.y);
    const recMonth = MONTH_NAMES[p.m - 1];
    if (f.period === "today") return recDate === todayStr();
    if (f.period === "week") return !!f.week && isoWeekOf(recDate) === f.week;
    if (f.period === "month") return f.year !== "All" && f.month !== "All" && recYear === f.year && recMonth === f.month;
    if (f.period === "year") return f.year !== "All" && recYear === f.year;
    if (f.period === "custom") return (!f.dateFrom || recDate >= f.dateFrom) && (!f.dateTo || recDate <= f.dateTo);
    return true;
  };

  // Switching the Date Period pre-fills its required value with the current
  // week / month / year so the selection is never left empty (an empty
  // selection used to silently match zero records).
  const handleFilterChange = (key, value) => {
    setFilterError("");
    setDraft((f) => {
      const next = { ...f, [key]: value };
      if (key === "period") {
        if (value === "week" && !next.week) next.week = isoWeekOf(todayStr());
        if (value === "month") {
          if (next.year === "All") next.year = currentYear();
          if (next.month === "All") next.month = currentMonth();
        }
        if (value === "year" && next.year === "All") next.year = currentYear();
      }
      return next;
    });
  };

  const clearFilters = () => {
    setFilterError("");
    setDraft(defaultFilters);
    setFilters(defaultFilters);
    setFilterApplied(false);
  };

  const applyFilters = () => {
    const today = todayStr();
    if (draft.period === "week" && !draft.week) { setFilterError("Please select a week."); return; }
    if (draft.period === "month" && (draft.month === "All" || draft.year === "All")) { setFilterError("Please select a month and year."); return; }
    if (draft.period === "year" && draft.year === "All") { setFilterError("Please select a year."); return; }
    if (draft.period === "custom") {
      if (!draft.dateFrom && !draft.dateTo) { setFilterError("Please select a start date or end date."); return; }
      if (draft.dateFrom && draft.dateFrom > today) { setFilterError("Start date cannot be a future date."); return; }
      if (draft.dateTo && draft.dateTo > today) { setFilterError("End date cannot be a future date."); return; }
      if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) { setFilterError("Start date cannot be later than end date."); return; }
    }
    // Keep only the values that belong to the chosen period so a value left
    // over from a previously selected period can never leak into the result.
    const next = {
      ...defaultFilters,
      batchId: draft.batchId,
      period: draft.period,
      ...(draft.period === "week" ? { week: draft.week } : {}),
      ...(draft.period === "month" ? { month: draft.month, year: draft.year } : {}),
      ...(draft.period === "year" ? { year: draft.year } : {}),
      ...(draft.period === "custom" ? { dateFrom: draft.dateFrom, dateTo: draft.dateTo } : {}),
    };
    setFilterError("");
    setDraft(next);
    setFilters(next);
    setFilterApplied(next.period !== "all" || next.batchId !== "All");
    setShowFilter(false);
  };
  const openFilterPanel = () => { setFilterError(""); setDraft(filters); setShowFilter((s) => !s); };
  const activeFilterCount =
    (filterApplied && filters.period !== "all" ? 1 : 0) +
    (filterApplied && filters.batchId !== "All" ? 1 : 0);

  const uniq = (vals) => [...new Set(vals.filter(Boolean))];
  const batchOptions = uniq(records.map((r) => r.batchId));

  const yearOptions = uniq([
    ...records.map((r) => { const p = dateParts(r.date); return p ? String(p.y) : null; }),
    draft.year !== "All" ? draft.year : null,
  ]).sort((a, b) => b - a);

  const monthOptions = uniq([
    ...records
      .filter((r) => { const p = dateParts(r.date); return p && (draft.year === "All" || String(p.y) === draft.year); })
      .map((r) => MONTH_NAMES[dateParts(r.date).m - 1]),
    draft.month !== "All" ? draft.month : null,
  ]).sort((a, b) => MONTH_NAMES.indexOf(a) - MONTH_NAMES.indexOf(b));

  const searchTerm = search.trim().toLowerCase();
  const matchesSearch = (r) =>
    !searchTerm ||
    [r.batchId, r.mortalityId, r.causeOfDeath].some((v) => String(v || "").toLowerCase().includes(searchTerm));

  const filtered = records.filter((r) =>
    matchesSearch(r) &&
    (!filterApplied || (
      (filters.batchId === "All" || r.batchId === filters.batchId) &&
      matchesDatePeriod(r, filters)
    ))
  );

  const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
  const sortAccessor = (row, col) => {
    if (col === "date") return row.date || "";
    if (col === "batchId") return row.batchId || "";
    if (col === "numberOfMortality") return Number(row.numberOfMortality) || 0;
    if (col === "causeOfDeath") return row.causeOfDeath || "";
    return "";
  };
  const sorted = sortData(filtered, sortAccessor);
  const pager = usePagination(sorted.length);
  useEffect(() => { pager.setPage(1); }, [search, filterApplied, filters]);
  const pageRows = sorted.slice(pager.startIndex, pager.endIndex);

  const batchesInView = uniq(filtered.map((r) => r.batchId));

  const totalRecords = filtered.length;
  const totalDeaths = filtered.reduce((sum, r) => sum + (Number(r.numberOfMortality) || 0), 0);
  const batchesAffected = batchesInView.length;

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

  const exportMeta = {
    farmName: farmInfo.farmName,
    location: farmInfo.farmLocation,
    contact: farmInfo.farmContact,
    email: farmInfo.farmEmail,
    logoUrl: farmInfo.farmLogo
      ? (farmInfo.farmLogo.startsWith("http") ? farmInfo.farmLogo : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${farmInfo.farmLogo}`)
      : "",
    period: periodLabel,
    fields: filterApplied && filters.batchId !== "All" ? [{ label: "Batch ID", value: filters.batchId }] : [],
  };

  const exportSummary = filtered.length
    ? [
        { label: "Total Records", value: String(totalRecords) },
        { label: "Total Deaths", value: String(totalDeaths) },
        { label: "Batches Affected", value: String(batchesAffected) },
      ]
    : [];

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "RECORDS", path: "/records" },
        { label: "MORTALITY RECORD" },
      ]}
    >
        {}
        <div className="mr-toolbar">
          <button className="mr-add-btn" onClick={() => navigate("/records/mortality/add")}>
            <FiPlus /> Add Mortality Record
          </button>
          <div className="mr-toolbar-right">
            <div className="mr-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="mr-btn-group">
              <div className="mr-filter-wrap" ref={filterRef}>
                <button className="mr-toolbar-btn" onClick={openFilterPanel}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="mr-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="mr-filter-dropdown">
                    <div className="mr-filter-dropdown-header">
                      <span>Filter Records</span>
                    </div>

                    <div className="mr-filter-section-label">Date Filter</div>
                    <div className="mr-filter-row">
                      <div className="mr-filter-group">
                        <label className="mr-filter-label">Date Period</label>
                        <select
                          className="mr-filter-select"
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
                        <div className="mr-filter-group">
                          <label className="mr-filter-label">Week</label>
                          <input
                            type="week"
                            className="mr-filter-select"
                            value={draft.week}
                            onChange={(e) => handleFilterChange("week", e.target.value)}
                          />
                        </div>
                      )}

                      {draft.period === "month" && (
                        <div className="mr-filter-group">
                          <label className="mr-filter-label">Month</label>
                          <select
                            className="mr-filter-select"
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
                        <div className="mr-filter-group">
                          <label className="mr-filter-label">Year</label>
                          <select
                            className="mr-filter-select"
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
                      <div className="mr-filter-group">
                        <label className="mr-filter-label">Start Date / End Date</label>
                        <div className="mr-filter-date-range">
                          <input type="date" className="mr-filter-select" value={draft.dateFrom}
                            max={draft.dateTo || todayStr()}
                            onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label="From date" />
                          <span>to</span>
                          <input type="date" className="mr-filter-select" value={draft.dateTo}
                            min={draft.dateFrom || undefined} max={todayStr()}
                            onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label="To date" />
                        </div>
                      </div>
                    )}

                    <div className="mr-filter-section-label">Filters</div>
                    <div className="mr-filter-row">
                      <div className="mr-filter-group">
                        <label className="mr-filter-label">Batch ID</label>
                        <select
                          className="mr-filter-select"
                          value={draft.batchId}
                          onChange={(e) => handleFilterChange("batchId", e.target.value)}
                        >
                          <option value="All">All Batches</option>
                          {batchOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {filterError && <div className="mr-filter-error">{filterError}</div>}

                    <div className="mr-filter-actions">
                      <button type="button" className="mr-filter-clear" onClick={clearFilters}>Clear All</button>
                      <button type="button" className="mr-filter-apply" onClick={applyFilters}>Apply</button>
                    </div>
                  </div>
                )}
              </div>

              <ExportMenu
                rows={sorted}
                columns={[
                  { key: "mortalityId", label: "Mortality ID" },
                  { key: "date", label: "Date" },
                  { key: "batchId", label: "Batch ID" },
                  { key: "numberOfMortality", label: "Number of Mortality" },
                  { key: "causeOfDeath", label: "Cause of Death" },
                  { key: "remarks", label: "Remarks" },
                ]}
                name="mortality-record"
                title="Mortality Monitoring Report"
                meta={exportMeta}
                pdfExtra={{ period: exportMeta.period, summary: exportSummary }}
                moduleLabel="Mortality Record"
                enablePreview
                filters={{
                  ...(filterApplied && filters.batchId !== "All" ? { "Batch ID": filters.batchId } : {}),
                  ...(filterApplied && filters.period !== "all" ? { "Report Period": periodLabel } : {}),
                }}
                className="mr-toolbar-btn"
              />
            </div>
          </div>
        </div>

        {error && <div className="mr-active-filters" style={{ color: "#d94f4f" }}>{error}</div>}

        {}
        <div className="mr-stats-grid">
          <div className="mr-stat-card">
            <div className="mr-stat-icon gold"><FiFileText /></div>
            <div>
              <h3>{totalRecords}</h3>
              <p>Total Records</p>
              <span>{statCardSpanLabel}</span>
            </div>
          </div>
          <div className="mr-stat-card">
            <div className="mr-stat-icon red"><FiHeart /></div>
            <div>
              <h3>{totalDeaths}</h3>
              <p>Total Deaths</p>
              <span>{statCardSpanLabel}</span>
            </div>
          </div>
          <div className="mr-stat-card">
            <div className="mr-stat-icon blue"><FiAlertCircle /></div>
            <div>
              <h3>{batchesAffected}</h3>
              <p>Batches Affected</p>
              <span>{statCardSpanLabel}</span>
            </div>
          </div>
        </div>

        {}
        <div className="mr-table-wrapper">
          <table className="mr-table">
            <thead>
              <tr>
                <th>MORTALITY ID</th>
                <th className="mr-sortable-th" onClick={() => cycleSort("date")}>DATE{sortIndicator("date", sortColumn, sortDirection)}</th>
                <th className="mr-sortable-th" onClick={() => cycleSort("batchId")}>BATCH ID{sortIndicator("batchId", sortColumn, sortDirection)}</th>
                <th className="mr-sortable-th" onClick={() => cycleSort("numberOfMortality")}>NUMBER OF MORTALITY{sortIndicator("numberOfMortality", sortColumn, sortDirection)}</th>
                <th className="mr-sortable-th" onClick={() => cycleSort("causeOfDeath")}>CAUSE OF DEATH{sortIndicator("causeOfDeath", sortColumn, sortDirection)}</th>
                <th>REMARKS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="mr-empty-state">Loading mortality records...</td>
                </tr>
              ) : filtered.length === 0 && records.length > 0 ? (
                <tr>
                  <td colSpan="7" className="mr-empty-state">
                    <div className="mr-empty-content">
                      <FiMaximize />
                      <h3>No mortality records found</h3>
                      <p>No matching mortality records were found for your search.</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="mr-empty-state">
                    <div className="mr-empty-content">
                      <FiMaximize />
                      <h3>No mortality records found</h3>
                      <p>Click Add Mortality Record to log your first entry.</p>
                      <button
                        className="mr-empty-add-btn"
                        onClick={() => navigate("/records/mortality/add")}
                      >
                        <FiPlus /> Add Mortality Record
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r._id}>
                    <td>{r.mortalityId || "—"}</td>
                    <td>{r.date  ? new Date(r.date).toISOString().split("T")[0]: "—"}</td>
                    <td><span className="mr-batch-badge">{r.batchId}</span></td>
                    <td className="mr-mortality-count">{r.numberOfMortality}</td>
                    <td>{r.causeOfDeath}</td>
                    <td>{renderRemarksCell(r, r.remarks)}</td>
                    <td>
                      <div className="mr-actions">
          {canEdit && (
                          <button
                            className="mr-btn-edit"
                            title="Edit"
                            onClick={() => navigate(`/records/mortality/edit/${r._id}`)}
                          >
                            <FiEdit2 />
                          </button>
                        )}
                        {canArchive && (
                          <button className="mr-btn-archive" onClick={() => requestArchive({ module: "Mortality Records", moduleKey: "pb_mortality", record: r, name: r.batchId || r.date })} title="Archive">
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

      {viewRecord && (
        <div className="pb-confirm-overlay" onClick={() => setViewRecord(null)}>
          <div className="pb-confirm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, textAlign: "left" }}>
            <h3 className="pb-confirm-title">Mortality Record — {viewRecord.batchId}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", margin: "12px 0" }}>
              <div><small>Batch ID</small><p style={{ margin: 0 }}>{viewRecord.batchId}</p></div>
              <div><small>Date</small><p style={{ margin: 0 }}>{viewRecord.date ? new Date(viewRecord.date).toLocaleDateString("en-CA") : "—"}</p></div>
              <div style={{ gridColumn: "1 / -1" }}><small>Remarks</small><p style={{ margin: 0 }}>{viewRecord.remarks || "—"}</p></div>
            </div>
            <div className="pb-confirm-actions">
              <button className="pb-confirm-cancel" onClick={() => setViewRecord(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}