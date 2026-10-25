import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiSearch, FiFilter, FiDownload,
  FiEye, FiArchive, FiMaximize, FiX,
} from "react-icons/fi";
import { BsQrCode } from "react-icons/bs";
import { MdPeople, MdPerson, MdPersonOff } from "react-icons/md";
import PageLayout from "../components/PageLayout";
import { useUser } from "../hooks/useUser";
import ExportMenu from "../components/ExportMenu";
import { getFarmInfo } from "../api/profile";
import "./Personnelandmanpower.css";
import { archiveRow } from "../archiveRow";
import { useArchiveConfirm } from "../hooks/useArchiveConfirm";
import ArchiveConfirmModal from "../components/ArchiveConfirmModal";
import { listPersonnel, getAttendanceQr } from "../api/personnelManpower";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination, { TableSection, TableScroll } from "../components/TablePagination";

const STATUS_OPTIONS = ["Active", "Inactive"];

const prof = (r) => r.profile || r.myProfile || r.user || r;const getId = (r) => r._id || r.id;
const getName = (r) => {
  const p = prof(r);
  return p.fullName || p.name || [p.firstName, p.lastName].filter(Boolean).join(" ") || r.employeeName || "—";
};

const getContact = (r) => {
  const p = prof(r);
  return p.contactNumber || p.contact || p.phone || p.mobile || p.phoneNumber || "—";
};
const getAccountRole = (r) =>
  r.accountRole ||
  r.userRole ||
  r.userType ||
  r.role ||
  r.user?.role ||
  r.profile?.role ||
  "";
const isOwnerRow = (r) => /^owner$/i.test(getAccountRole(r));

const getPosition = (r) =>
  r.position || r.jobTitle || r.designation || r.jobRole || "—";

const getDisplayPosition = (r) =>
  isOwnerRow(r) ? "Owner" : getPosition(r);
const getStatus = (r) => r.status || "Active";
const getRemarks = (r) => r.remarks || r.notes || "—";

const NameCell = ({ r }) => <span>{getName(r)}</span>;

export default function PersonnelManpower() {
  const navigate = useNavigate();
  const { canArchive, isOwner, user: currentUser } = useUser();
  const { pending: archivePending, requestArchive, cancelArchive, confirmArchive } = useArchiveConfirm();

  const canViewRow = (r) => {
    if (isOwner) return true;
    if (!isOwnerRow(r)) return true;
    return String(r.user?._id) === String(currentUser?.id);
  };
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("farmers");

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [qrOpen, setQrOpen] = useState(false);
  const [qrPath, setQrPath] = useState("");
  const [qrError, setQrError] = useState("");

  const [showFilter, setShowFilter] = useState(false);
  const defaultFilters = { status: "All", period: "all", year: "All", month: "All", week: "", dateFrom: "", dateTo: "" };
  const [filters, setFilters] = useState(defaultFilters);
  const [draft, setDraft] = useState(defaultFilters);
  const [filterApplied, setFilterApplied] = useState(false);
  const filterRef = useRef(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [farmInfo, setFarmInfo] = useState({ farmName: "", farmLocation: "", farmContact: "", farmEmail: "", farmLogo: "" });

  useEffect(() => {
    const onChange = () => setRefreshKey((k) => k + 1);
    window.addEventListener("pb_data_changed", onChange);
    return () => window.removeEventListener("pb_data_changed", onChange);
  }, []);

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await listPersonnel();
        const list = Array.isArray(data) ? data : data.records || data.data || [];
        setRecords(list);
      } catch (err) {
        setRecords([]);
        setError(err?.message || "Couldn't load personnel records.");
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, [refreshKey]);

  useEffect(() => {
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

  const getDateHired = (r) => (r.dateHired ? String(r.dateHired).slice(0, 10) : "");

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
  const activeFilterCount =
    (filterApplied && filters.period !== "all" ? 1 : 0) +
    (filterApplied && filters.status !== "All" ? 1 : 0);

  const yearOptions = [...new Set(
    records.map((r) => { const d = new Date(getDateHired(r)); return isNaN(d) ? null : String(d.getFullYear()); }).filter(Boolean)
  )].sort((a, b) => b - a);

  const monthOptions = [...new Set(
    records
      .filter((r) => draft.year === "All" || String(new Date(getDateHired(r)).getFullYear()) === draft.year)
      .map((r) => { const d = new Date(getDateHired(r)); return isNaN(d) ? null : MONTH_NAMES[d.getMonth()]; })
      .filter(Boolean)
  )].sort((a, b) => MONTH_NAMES.indexOf(a) - MONTH_NAMES.indexOf(b));

  const matchesDatePeriod = (r, f) => {
    if (f.period === "all") return true;
    const date = getDateHired(r);
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
    const matchSearch =
      getName(r).toLowerCase().includes(q) ||
      getPosition(r).toLowerCase().includes(q);
    const matchStatus = !filterApplied || filters.status === "All" || getStatus(r) === filters.status;
    const matchDate = !filterApplied || matchesDatePeriod(r, filters);
    return matchSearch && matchStatus && matchDate;
  };

  const owners = records.filter(isOwnerRow).filter(matches);
  const farmers = records.filter((r) => !isOwnerRow(r)).filter(matches);

  const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
  const sortAccessor = (row, col) => {
    if (col === "name") return getName(row) || "";
    if (col === "contact") return getContact(row) || "";
    if (col === "position") return getDisplayPosition(row) || "";
    if (col === "status") return getStatus(row) || "";
    return "";
  };
  const sortedOwners = sortData(owners, sortAccessor);
  const sortedFarmers = sortData(farmers, sortAccessor);
  const activeSorted = activeTab === "owner" ? sortedOwners : sortedFarmers;
  const pager = usePagination(activeSorted.length);
  useEffect(() => { pager.setPage(1); }, [search, filters, filterApplied, activeTab]);
  const pageOwners = sortedOwners.slice(pager.startIndex, pager.endIndex);
  const pageFarmers = sortedFarmers.slice(pager.startIndex, pager.endIndex);

  const allMatching = records.filter(matches);
  const total = allMatching.length;
  const activeCount = allMatching.filter((r) => getStatus(r) === "Active").length;
  const inactiveCount = allMatching.filter((r) => getStatus(r) === "Inactive").length;

  // The PDF lists only the active tab's records, so its summary is
  // computed from that same list to keep the totals and rows in sync.
  const exportSource = activeTab === "owner" ? owners : farmers;
  const exportSummary = [
    { label: "Total Personnel", value: String(exportSource.length) },
    { label: "Active", value: String(exportSource.filter((r) => getStatus(r) === "Active").length) },
    { label: "Inactive", value: String(exportSource.filter((r) => getStatus(r) === "Inactive").length) },
  ];

  const exportMeta = {
    farmName: farmInfo.farmName,
    location: farmInfo.farmLocation,
    contact: farmInfo.farmContact,
    email: farmInfo.farmEmail,
    logoUrl: farmInfo.farmLogo
      ? (farmInfo.farmLogo.startsWith("http") ? farmInfo.farmLogo : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${farmInfo.farmLogo}`)
      : "",
    period: periodLabel,
    fields: filterApplied && filters.status !== "All" ? [{ label: "Status", value: filters.status }] : [],
  };

  const isOwnerTab = activeTab === "owner";
  const exportText = (value) =>
    value == null || typeof value === "object" || String(value).trim() === "" ? "—" : String(value);

  const exportColumns = [
    { key: "name", label: "Full Name" },
    { key: "contact", label: "Contact Number" },
    { key: "position", label: "Position" },
    { key: "status", label: "Status" },
    { key: "remarks", label: "Remarks" },
  ];

  const exportRows = (isOwnerTab ? sortedOwners : sortedFarmers).map((r) => ({
    name: exportText(getName(r)),
    contact: exportText(getContact(r)),
    position: exportText(getDisplayPosition(r)),
    status: exportText(getStatus(r)),
    remarks: exportText(getRemarks(r)),
  }));

  // The official attendance QR points to the check-in page with the farm's
  // attendance code from the backend (Owner only). It carries no login
  // details -- the person is identified by their own login when scanning.
  useEffect(() => {
    if (!qrOpen || qrPath) return undefined;

    let cancelled = false;

    getAttendanceQr()
      .then((data) => {
        if (!cancelled) setQrPath(data?.checkInPath || "");
      })
      .catch((err) => {
        if (!cancelled) setQrError(err?.message || "Couldn't load the attendance QR code.");
      });

    return () => {
      cancelled = true;
    };
  }, [qrOpen, qrPath]);

  const CHECKIN_URL = qrPath
    ? (typeof window !== "undefined" ? window.location.origin : "") + qrPath
    : "";
  const STATION_QR = CHECKIN_URL
    ? "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(CHECKIN_URL)
    : "";

  const statusBadge = (status) => (
    <span className={`status ${String(status).toLowerCase().replace(" ", "-")}`}>{status}</span>
  );

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "PERSONNEL AND VISITORS", path: "/personnel-visitors" },
        { label: "PERSONNEL AND MANPOWER" },
      ]}
    >

        {}
        <div className="pm-toolbar">
          <div className="pm-toolbar-right">
            <div className="pm-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="pm-btn-group">
              <div className="pm-filter-wrap" ref={filterRef}>
                <button className="pm-toolbar-btn" onClick={openFilterPanel}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="pm-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="pm-filter-dropdown">
                    <div className="pm-filter-dropdown-header">
                      <span>Filter Records</span>
                    </div>

                    <div className="pm-filter-section-label">Date Filter (Date Hired)</div>
                    <div className="pm-filter-row">
                      <div className="pm-filter-group">
                        <label className="pm-filter-label">Date Period</label>
                        <select
                          className="pm-filter-select"
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
                        <div className="pm-filter-group">
                          <label className="pm-filter-label">Week</label>
                          <input
                            type="week"
                            className="pm-filter-select"
                            value={draft.week}
                            onChange={(e) => handleFilterChange("week", e.target.value)}
                          />
                        </div>
                      )}

                      {draft.period === "month" && (
                        <div className="pm-filter-group">
                          <label className="pm-filter-label">Month</label>
                          <select
                            className="pm-filter-select"
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
                        <div className="pm-filter-group">
                          <label className="pm-filter-label">Year</label>
                          <select
                            className="pm-filter-select"
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
                      <div className="pm-filter-group">
                        <label className="pm-filter-label">Start Date / End Date</label>
                        <div className="pm-filter-date-range">
                          <input type="date" className="pm-filter-select" value={draft.dateFrom}
                            max={draft.dateTo || todayStr()}
                            onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label="From date" />
                          <span>to</span>
                          <input type="date" className="pm-filter-select" value={draft.dateTo}
                            min={draft.dateFrom || undefined} max={todayStr()}
                            onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label="To date" />
                        </div>
                      </div>
                    )}

                    <div className="pm-filter-section-label">Filters</div>
                    <div className="pm-filter-row">
                      <div className="pm-filter-group">
                        <label className="pm-filter-label">Status</label>
                        <select
                          className="pm-filter-select"
                          value={draft.status}
                          onChange={(e) => handleFilterChange("status", e.target.value)}
                        >
                          <option value="All">All Statuses</option>
                          {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="pm-filter-actions">
                      <button className="pm-filter-clear" onClick={clearFilters}>Clear All</button>
                      <button className="pm-filter-apply" onClick={applyFilters}>Apply</button>
                    </div>
                  </div>
                )}
              </div>

              <button className="pm-toolbar-btn" onClick={() => { setQrError(""); setQrOpen(true); }}><BsQrCode /> QR Generation</button>
              <ExportMenu
                rows={exportRows}
                columns={exportColumns}
                name={`personnel-${isOwnerTab ? "owner" : "farmers"}`}
                title="Personnel Management Report"
                meta={exportMeta}
                pdfExtra={{ period: exportMeta.period, summary: exportSummary, hideApprovalAndTagline: true }}
                moduleLabel="Personnel & Manpower"
                enablePreview
                filters={{
                  ...(filterApplied && filters.status !== "All" ? { "Status": filters.status } : {}),
                  ...(periodLabel !== "All Records" ? { "Report Period": periodLabel } : {}),
                }}
                className="pm-toolbar-btn"
              />
            </div>
          </div>
        </div>

        {error && <div className="pb-error-banner">{error}</div>}

        {}
        <div className="pm-stats-grid">
          <div className="pm-stat-card">
            <div className="pm-stat-icon gold"><MdPeople /></div>
            <div>
              <h3>{total}</h3>
              <p>Total Personnel</p>
              <span>All Registered</span>
            </div>
          </div>

          <div className="pm-stat-card">
            <div className="pm-stat-icon green"><MdPerson /></div>
            <div>
              <h3>{activeCount}</h3>
              <p>Active</p>
              <span>Currently Employed</span>
            </div>
          </div>

          <div className="pm-stat-card">
            <div className="pm-stat-icon blue"><MdPersonOff /></div>
            <div>
              <h3>{inactiveCount}</h3>
              <p>Inactive</p>
              <span>Not Currently Active</span>
            </div>
          </div>
        </div>

        {}
        <div className="pm-tabs">
          <button
            className={`pm-tab ${activeTab === "farmers" ? "active" : ""}`}
            onClick={() => setActiveTab("farmers")}
          >
            <MdPeople /> Personnel (Farmers)
          </button>
          <button
            className={`pm-tab ${activeTab === "owner" ? "active" : ""}`}
            onClick={() => setActiveTab("owner")}
          >
            <MdPerson /> Owner
          </button>
        </div>

        <TableSection className="pm-table-wrapper">
          <TableScroll>

          {}
          {activeTab === "owner" && (
            <table className="pm-table">
              <thead>
                <tr>
                  <th className="pm-sortable-th" onClick={() => cycleSort("name")}>Full Name{sortIndicator("name", sortColumn, sortDirection)}</th>
                  <th className="pm-sortable-th" onClick={() => cycleSort("contact")}>Contact Number{sortIndicator("contact", sortColumn, sortDirection)}</th>
                  <th className="pm-sortable-th" onClick={() => cycleSort("position")}>Position{sortIndicator("position", sortColumn, sortDirection)}</th>
                  <th className="pm-sortable-th" onClick={() => cycleSort("status")}>Status{sortIndicator("status", sortColumn, sortDirection)}</th>
                  <th>Remarks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="pm-empty-state">Loading...</td></tr>
                ) : owners.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="pm-empty-state">
                      <div className="pm-empty-content">
                        <FiMaximize />
                        <h3>No owner found</h3>
                        <p>Owner appears here automatically after registration.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageOwners.map((r) => (
                    <tr key={getId(r)}>
                      <td><NameCell r={r} /></td>
                      <td>{getContact(r)}</td>
                      <td>{getDisplayPosition(r)}</td>
                      <td>{statusBadge(getStatus(r))}</td>
                      <td>{getRemarks(r)}</td>
                      <td>
                        <div className="pm-actions">
                          <button className="pm-btn-view" title={canViewRow(r) ? "View" : "You can only view your own record"} disabled={!canViewRow(r)} onClick={() => canViewRow(r) && navigate(`/personnel-visitors/personnel/view/${getId(r)}`)}><FiEye /></button>
                          {isOwner && !isOwnerRow(r) && (
                            <button className="pm-btn-archive" onClick={() => requestArchive({ module: "Personnel & Manpower", moduleKey: "pb_personnel", record: r, name: r.fullName || r.name })} title="Archive"><FiArchive /></button>
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
          {activeTab === "farmers" && (
            <table className="pm-table">
              <thead>
                <tr>
                  <th className="pm-sortable-th" onClick={() => cycleSort("name")}>Full Name{sortIndicator("name", sortColumn, sortDirection)}</th>
                  <th className="pm-sortable-th" onClick={() => cycleSort("contact")}>Contact Number{sortIndicator("contact", sortColumn, sortDirection)}</th>
                  <th className="pm-sortable-th" onClick={() => cycleSort("position")}>Position{sortIndicator("position", sortColumn, sortDirection)}</th>
                  <th className="pm-sortable-th" onClick={() => cycleSort("status")}>Status{sortIndicator("status", sortColumn, sortDirection)}</th>
                  <th>Remarks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="pm-empty-state">Loading personnel records...</td></tr>
                ) : farmers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="pm-empty-state">
                      <div className="pm-empty-content">
                        <FiMaximize />
                        <h3>No personnel records found</h3>
                        <p>Farmers appear here automatically once their account is approved by the Owner.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageFarmers.map((r) => (
                    <tr key={getId(r)}>
                      <td><NameCell r={r} /></td>
                      <td>{getContact(r)}</td>
                      <td>{getDisplayPosition(r)}</td>
                      <td>{statusBadge(getStatus(r))}</td>
                      <td>{getRemarks(r)}</td>
                      <td>
                        <div className="pm-actions">
                          <button className="pm-btn-view" title={canViewRow(r) ? "View" : "You can only view your own record"} disabled={!canViewRow(r)} onClick={() => canViewRow(r) && navigate(`/personnel-visitors/personnel/view/${getId(r)}`)}><FiEye /></button>
                          {canArchive && (
                          <button className="pm-btn-archive" onClick={() => requestArchive({ module: "Personnel & Manpower", moduleKey: "pb_personnel", record: r, name: r.fullName || r.name })} title="Archive"><FiArchive /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

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
              <div className="qr-modal-title">
                <BsQrCode />
                <h3>QR Attendance</h3>
              </div>
              <button className="qr-close" onClick={() => setQrOpen(false)} aria-label="Close"><FiX /></button>
            </div>


            <div className="qr-station">
              {}
              {qrError && <div className="pb-error-banner">{qrError}</div>}
              <div className="qr-frame">
                {STATION_QR ? (
                  <img className="qr-station-img" src={STATION_QR} alt="Attendance QR code" loading="lazy" />
                ) : (
                  !qrError && <p className="pb-loading-text">Loading QR code...</p>
                )}
                <span className="qr-frame-caption">Attendance QR</span>
              </div>

              {}
              <button
                className="qr-download-btn"
                onClick={() => STATION_QR && window.open(STATION_QR, "_blank", "noopener,noreferrer")}
                disabled={!STATION_QR}
              >
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