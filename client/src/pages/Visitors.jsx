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
import TablePagination from "../components/TablePagination";
import "../components/TablePagination.css";

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
  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "" });
  const filterRef = useRef(null);
  const [farmInfo, setFarmInfo] = useState({ farmName: "", farmLocation: "", farmContact: "", farmEmail: "", farmLogo: "" });

  const [qrOpen, setQrOpen] = useState(false);
  const CHECKIN_URL = (typeof window !== "undefined" ? window.location.origin : "") + "/visitor/check-in";
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

  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({ dateFrom: "", dateTo: "" });
  const activeFilterCount = Object.entries(filters).filter(([, v]) => v && v !== "All").length;

  const matches = (r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || getName(r).toLowerCase().includes(q);
    const dateStr = r.lastVisitDate ? String(r.lastVisitDate).slice(0, 10) : "";
    const matchDate =
      (!filters.dateFrom || (dateStr && dateStr >= filters.dateFrom)) &&
      (!filters.dateTo || (dateStr && dateStr <= filters.dateTo));
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
  useEffect(() => { pager.setPage(1); }, [search, filters]);
  const pageVisitors = sortedVisitors.slice(pager.startIndex, pager.endIndex);

  const totalVisitors = visitors.length;
  const visitsThisMonth = visitors.reduce((sum, r) => sum + (Number(r.visitCount) || 0), 0);
  const isToday = (r) => {
    if (r.lastVisitDate) return new Date(r.lastVisitDate).toDateString() === new Date().toDateString();
    if (r.lastVisitOffset != null) return Number(r.lastVisitOffset) === 0;
    return false;
  };
  const visitsToday = visitors.filter(isToday).length;

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
    fields: [],
  };

  const exportSummary = visitors.length
    ? [
        { label: "Total Visitors", value: String(totalVisitors) },
        { label: "Visits This Month", value: String(visitsThisMonth) },
        { label: "Visits Today", value: String(visitsToday) },
      ]
    : [];

  // Export columns/rows mirror the on-screen table exactly (see the
  // <thead>/<tbody> below) — same fields, same labels, same formatting.
  const exportColumns = [
    { key: "name", label: "Full Name" },
    { key: "address", label: "Address" },
    { key: "affiliation", label: "Affiliation / Company" },
    { key: "contact", label: "Contact Number" },
  ];
  const exportRows = visitors.map((r) => ({
    name: getName(r),
    address: getAddress(r),
    affiliation: getAffiliation(r),
    contact: getContact(r),
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
                <button className="vt-toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="vt-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="vt-filter-dropdown">
                    <div className="vt-filter-dropdown-header">
                      <span>Filter Visitors</span>
                      <button className="vt-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>

                    <div className="vt-filter-group">
                      <label className="vt-filter-label">Report Period</label>
                      <div className="vt-filter-date-range">
                        <input type="date" className="vt-filter-select" value={filters.dateFrom}
                          onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label="From date" />
                        <span>to</span>
                        <input type="date" className="vt-filter-select" value={filters.dateTo}
                          onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label="To date" />
                      </div>
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
                pdfExtra={{ period: exportMeta.period, summary: exportSummary }}
                moduleLabel="Visitors"
                enablePreview
                filters={{
                  ...(periodLabel !== "All Time" ? { "Report Period": periodLabel } : {}),
                }}
                className="vt-toolbar-btn"
              />
            </div>
          </div>
        </div>

        {}
        {activeFilterCount > 0 && (
          <div className="vt-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value && value !== "All" ? (
                <span key={key} className="vt-active-filter-tag">
                  {key === "dateFrom" ? "From" : "To"}: {value}
                  <button onClick={() => handleFilterChange(key, key === "dateFrom" || key === "dateTo" ? "" : "All")}>✕</button>
                </span>
              ) : null
            )}
          </div>
        )}

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
              <span>All Time</span>
            </div>
          </div>
          <div className="vt-stat-card">
            <div className="vt-stat-icon green"><MdEventNote /></div>
            <div>
              <h3>{visitsThisMonth}</h3>
              <p>Visits This Month</p>
              <span>All Records</span>
            </div>
          </div>
          <div className="vt-stat-card">
            <div className="vt-stat-icon blue"><MdHowToReg /></div>
            <div>
              <h3>{visitsToday}</h3>
              <p>Visits Today</p>
              <span>All Records</span>
            </div>
          </div>
        </div>

        {}
        <div className="vt-table-wrapper">
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