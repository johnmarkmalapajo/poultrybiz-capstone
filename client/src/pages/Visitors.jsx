import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiSearch, FiFilter, FiDownload, FiEye, FiArchive, FiMaximize, FiX,
} from "react-icons/fi";
import { BsQrCode } from "react-icons/bs";
import { MdGroups, MdHowToReg, MdEventNote } from "react-icons/md";
import PageLayout from "../components/PageLayout";
import { useUser } from "../hooks/useUser";
import ExportMenu from "../components/ExportMenu";
import "./Visitors.css";
import { archiveRow } from "../archiveRow";
import { useArchiveConfirm } from "../hooks/useArchiveConfirm";
import ArchiveConfirmModal from "../components/ArchiveConfirmModal";
import { listVisitors } from "../api/visitorLog";
import { getFarmInfo } from "../api/profile";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination, { TableSection, TableScroll } from "../components/TablePagination";

const getId = (r) => r._id || r.id;
const getName = (r) => r.fullName || r.name || "—";
const getAddress = (r) => r.address || "—";
const getAffiliation = (r) => r.affiliation || r.company || r.organization || "—";
const getContact = (r) => r.contactNumber || r.contact || "—";
const isArchived = (r) => Boolean(r.archived);

export default function Visitors() {
  const navigate = useNavigate();
  const { canArchive } = useUser();
  const { pending: archivePending, requestArchive, cancelArchive, confirmArchive } = useArchiveConfirm();
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const defaultFilters = { period: "all", year: "All", month: "All", week: "", dateFrom: "", dateTo: "" };
  const [filters, setFilters] = useState(defaultFilters);
  const [draft, setDraft] = useState(defaultFilters);
  const [filterApplied, setFilterApplied] = useState(false);
  const filterRef = useRef(null);
  const [farmInfo, setFarmInfo] = useState({ farmName: "", farmLocation: "", farmContact: "", farmEmail: "", farmLogo: "" });

  const [qrOpen, setQrOpen] = useState(false);
  const CHECKIN_URL = (typeof window !== "undefined" ? window.location.origin : "") + "/visitor/register";
  const STATION_QR =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(CHECKIN_URL);

  useEffect(() => {
    setLoading(true);
    listVisitors()
      .then((d) => {
        const list = Array.isArray(d) ? d : d.records || d.data || [];
        setRecords(list);
      })
      .catch((err) => { setRecords([]); setError(err?.message || "Couldn't load visitor records."); })
      .finally(() => setLoading(false));
    getFarmInfo().then((d) => setFarmInfo(d)).catch(() => {});
  }, []);

  useEffect(() => {
    const handle = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

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

  const getLastVisit = (r) => (r.lastVisitDate ? String(r.lastVisitDate).slice(0, 10) : "");

  const handleFilterChange = (key, value) => setDraft((f) => ({ ...f, [key]: value }));
  const clearFilters = () => { setDraft(defaultFilters); setFilters(defaultFilters); setFilterApplied(false); };
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
  const activeFilterCount = filterApplied && filters.period !== "all" ? 1 : 0;

  const yearOptions = [...new Set(
    records.map((r) => { const d = new Date(getLastVisit(r)); return isNaN(d) ? null : String(d.getFullYear()); }).filter(Boolean)
  )].sort((a, b) => b - a);

  const monthOptions = [...new Set(
    records
      .filter((r) => draft.year === "All" || String(new Date(getLastVisit(r)).getFullYear()) === draft.year)
      .map((r) => { const d = new Date(getLastVisit(r)); return isNaN(d) ? null : MONTH_NAMES[d.getMonth()]; })
      .filter(Boolean)
  )].sort((a, b) => MONTH_NAMES.indexOf(a) - MONTH_NAMES.indexOf(b));

  const matchesDatePeriod = (r, f) => {
    if (f.period === "all") return true;
    const date = getLastVisit(r);
    const d = new Date(date);
    const recYear = isNaN(d) ? null : String(d.getFullYear());
    const recMonth = isNaN(d) ? null : MONTH_NAMES[d.getMonth()];
    if (f.period === "today") return date === todayStr();
    if (f.period === "week") return !!f.week && isoWeekOf(date) === f.week;
    if (f.period === "month") return f.year !== "All" && f.month !== "All" && recYear === f.year && recMonth === f.month;
    if (f.period === "year") return f.year !== "All" && recYear === f.year;
    if (f.period === "custom") return !!date && (!f.dateFrom || date >= f.dateFrom) && (!f.dateTo || date <= f.dateTo);
    return true;
  };

  const periodLabel = (() => {
    if (!filterApplied || filters.period === "all") return "All Records";
    if (filters.period === "today") return "Today";
    if (filters.period === "week" && filters.week) return filters.week;
    if (filters.period === "month" && filters.month !== "All" && filters.year !== "All") return `${filters.month} ${filters.year}`;
    if (filters.period === "year" && filters.year !== "All") return filters.year;
    if (filters.period === "custom" && (filters.dateFrom || filters.dateTo)) return `${filters.dateFrom || "—"} – ${filters.dateTo || "—"}`;
    return "All Records";
  })();

  const matches = (r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || getName(r).toLowerCase().includes(q);
    const matchDate = !filterApplied || matchesDatePeriod(r, filters);
    return matchSearch && matchDate;
  };
  const visitors = records.filter((r) => !isArchived(r)).filter(matches);

  const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
  const sortAccessor = (row, col) => {
    if (col === "name") return getName(row) || "";
    if (col === "address") return getAddress(row) || "";
    if (col === "affiliation") return getAffiliation(row) || "";
    if (col === "contact") return getContact(row) || "";
    return "";
  };
  const sortedVisitors = sortData(visitors, sortAccessor);
  const pager = usePagination(sortedVisitors.length);
  useEffect(() => { pager.setPage(1); }, [search, filters, filterApplied]);
  const pageVisitors = sortedVisitors.slice(pager.startIndex, pager.endIndex);

  const totalVisitors = visitors.length;
  const visitsThisMonth = visitors.reduce((sum, r) => sum + (Number(r.visitCount) || 0), 0);
  const isToday = (r) => {
    if (r.lastVisitDate) return new Date(r.lastVisitDate).toDateString() === new Date().toDateString();
    if (r.lastVisitOffset != null) return Number(r.lastVisitOffset) === 0;
    return false;
  };
  const visitsToday = visitors.filter(isToday).length;

  const exportMeta = {
    farmName: farmInfo.farmName,
    location: farmInfo.farmLocation,
    contact: farmInfo.farmContact,
    email: farmInfo.farmEmail,
    logoUrl: farmInfo.farmLogo
      ? (farmInfo.farmLogo.startsWith("http") ? farmInfo.farmLogo : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${farmInfo.farmLogo}`)
      : "",
    period: periodLabel,
    fields: [],
  };

  const exportSummary = visitors.length
    ? [
        { label: "Total Visitors", value: String(totalVisitors) },
        { label: "Visits This Month", value: String(visitsThisMonth) },
        { label: "Visits Today", value: String(visitsToday) },
      ]
    : [];

  // Export columns/rows mirror the on-screen table (see the <thead>/<tbody>
  // below), plus each visitor's last visit date and total visit count.
  const exportColumns = [
    { key: "name", label: "Full Name" },
    { key: "address", label: "Address" },
    { key: "affiliation", label: "Affiliation / Company" },
    { key: "contact", label: "Contact Number" },
    { key: "lastVisit", label: "Last Visit" },
    { key: "visits", label: "Total Visits" },
  ];
  const exportRows = sortedVisitors.map((r) => ({
    name: getName(r),
    address: getAddress(r),
    affiliation: getAffiliation(r),
    contact: getContact(r),
    lastVisit: r.lastVisitDate ? String(r.lastVisitDate).slice(0, 10) : "—",
    visits: String(Number(r.visitCount) || 0),
  }));

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "PERSONNEL AND VISITORS", path: "/personnel-visitors" },
        { label: "VISITOR'S LOG" },
      ]}
    >
        {}
        <div className="vt-toolbar">
          <div className="vt-toolbar-actions">
            <div className="vt-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search visitors by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="vt-toolbar-btn-group">
              <div className="vt-filter-wrap" ref={filterRef}>
                <button className="vt-toolbar-btn" onClick={openFilterPanel}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="vt-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="vt-filter-dropdown">
                    <div className="vt-filter-dropdown-header">
                      <span>Filter Visitors</span>
                    </div>

                    <div className="vt-filter-section-label">Date Filter (Last Visit)</div>
                    <div className="vt-filter-row">
                      <div className="vt-filter-group">
                        <label className="vt-filter-label">Date Period</label>
                        <select
                          className="vt-filter-select"
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
                        <div className="vt-filter-group">
                          <label className="vt-filter-label">Week</label>
                          <input
                            type="week"
                            className="vt-filter-select"
                            value={draft.week}
                            onChange={(e) => handleFilterChange("week", e.target.value)}
                          />
                        </div>
                      )}

                      {draft.period === "month" && (
                        <div className="vt-filter-group">
                          <label className="vt-filter-label">Month</label>
                          <select
                            className="vt-filter-select"
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
                        <div className="vt-filter-group">
                          <label className="vt-filter-label">Year</label>
                          <select
                            className="vt-filter-select"
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
                      <div className="vt-filter-group">
                        <label className="vt-filter-label">Start Date / End Date</label>
                        <div className="vt-filter-date-range">
                          <input type="date" className="vt-filter-select" value={draft.dateFrom}
                            max={draft.dateTo || todayStr()}
                            onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label="From date" />
                          <span>to</span>
                          <input type="date" className="vt-filter-select" value={draft.dateTo}
                            min={draft.dateFrom || undefined} max={todayStr()}
                            onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label="To date" />
                        </div>
                      </div>
                    )}

                    <div className="vt-filter-actions">
                      <button className="vt-filter-clear" onClick={clearFilters}>Clear All</button>
                      <button className="vt-filter-apply" onClick={applyFilters}>Apply</button>
                    </div>
                  </div>
                )}
              </div>

              <button className="vt-toolbar-btn" onClick={() => setQrOpen(true)}><BsQrCode /> QR Generation</button>
              <ExportMenu
                rows={exportRows}
                columns={exportColumns}
                name="visitors"
                title="Visitor Log Report"
                meta={exportMeta}
                pdfExtra={{ period: exportMeta.period, summary: exportSummary, hideApprovalAndTagline: true }}
                moduleLabel="Visitors"
                enablePreview
                filters={{
                  ...(periodLabel !== "All Records" ? { "Report Period": periodLabel } : {}),
                }}
                className="vt-toolbar-btn"
              />
            </div>
          </div>
        </div>

        {}
        {error && (
          <div className="pb-error-banner">
            {error}
          </div>
        )}
        <div className="vt-stats-grid">
          <div className="vt-stat-card">
            <div className="vt-stat-icon gold"><MdGroups /></div>
            <div>
              <h3>{totalVisitors}</h3>
              <p>Total Visitors</p>
              <span>{periodLabel === "All Records" ? "All Time" : periodLabel}</span>
            </div>
          </div>
          <div className="vt-stat-card">
            <div className="vt-stat-icon green"><MdEventNote /></div>
            <div>
              <h3>{visitsThisMonth}</h3>
              <p>Visits This Month</p>
              <span>{periodLabel}</span>
            </div>
          </div>
          <div className="vt-stat-card">
            <div className="vt-stat-icon blue"><MdHowToReg /></div>
            <div>
              <h3>{visitsToday}</h3>
              <p>Visits Today</p>
              <span>{periodLabel}</span>
            </div>
          </div>
        </div>

        {}
        <TableSection className="vt-table-wrapper">
          <TableScroll>
          <table className="vt-table">
            <thead>
              <tr>
                <th className="vt-sortable-th" onClick={() => cycleSort("name")}>Full Name{sortIndicator("name", sortColumn, sortDirection)}</th>
                <th className="vt-sortable-th" onClick={() => cycleSort("address")}>Address{sortIndicator("address", sortColumn, sortDirection)}</th>
                <th className="vt-sortable-th" onClick={() => cycleSort("affiliation")}>Affiliation / Company{sortIndicator("affiliation", sortColumn, sortDirection)}</th>
                <th className="vt-sortable-th" onClick={() => cycleSort("contact")}>Contact Number{sortIndicator("contact", sortColumn, sortDirection)}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="vt-empty-state">Loading visitors...</td>
                </tr>
              ) : visitors.length === 0 ? (
                <tr>
                  <td colSpan="5" className="vt-empty-state">
                    <div className="vt-empty-content">
                      <FiMaximize />
                      <h3>No visitors found</h3>
                      <p>Visitors appear here automatically once they register by scanning the farm QR code.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pageVisitors.map((r) => (
                  <tr key={getId(r)}>
                    <td className="vt-name">{getName(r)}</td>
                    <td>{getAddress(r)}</td>
                    <td>{getAffiliation(r)}</td>
                    <td>{getContact(r)}</td>
                    <td>
                      <div className="vt-actions">
                        <button
                          className="vt-btn-view"
                          title="View"
                          onClick={() => navigate(`/personnel-visitors/visitors/view/${getId(r)}`)}
                        >
                          <FiEye />
                        </button>
                        {canArchive && (
                        <button
                          className="vt-btn-archive"
                          onClick={() => requestArchive({ module: "Visitors", moduleKey: "pb_visitors", record: r, name: r.fullName || r.name })}
                          title="Archive"
                        >
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
          </TableScroll>
          <TablePagination
            currentPage={pager.page}
            totalPages={pager.totalPages}
            pageSize={pager.rowsPerPage}
            totalRecords={pager.totalItems}
            startIndex={pager.startIndex}
            endIndex={pager.endIndex}
            onPageChange={pager.setPage}
            onPageSizeChange={pager.setRowsPerPage}
          />
        </TableSection>

      {}
      {qrOpen && (
        <div className="qr-overlay" onClick={() => setQrOpen(false)}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qr-modal-header">
              <div className="qr-modal-title"><BsQrCode /><h3>Visitor QR Code</h3></div>
              <button className="qr-close" onClick={() => setQrOpen(false)} aria-label="Close"><FiX /></button>
            </div>

            <div className="qr-station">
              <div className="qr-frame">
                <img className="qr-station-img" src={STATION_QR} alt="Visitor QR code" loading="lazy" />
                <span className="qr-frame-caption">Farm Entrance QR</span>
              </div>
              <button className="qr-download-btn" onClick={() => window.open(STATION_QR, "_blank", "noopener,noreferrer")}>
                <FiDownload /> Download QR
              </button>
            </div>
          </div>
        </div>
      )}

      <ArchiveConfirmModal pending={archivePending} onCancel={cancelArchive} onConfirm={confirmArchive} />
    </PageLayout>
  );
}