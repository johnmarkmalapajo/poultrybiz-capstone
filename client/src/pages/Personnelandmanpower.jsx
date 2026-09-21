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
import { listPersonnel } from "../api/personnelManpower";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination from "../components/TablePagination";
import "../components/TablePagination.css";

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

  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ status: "All" });
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

  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({ status: "All" });
  const activeFilterCount = Object.values(filters).filter((v) => v !== "All").length;

  const matches = (r) => {
    const q = search.toLowerCase();
    const matchSearch =
      getName(r).toLowerCase().includes(q) ||
      getPosition(r).toLowerCase().includes(q);
    const matchStatus = filters.status === "All" || getStatus(r) === filters.status;
    return matchSearch && matchStatus;
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
  useEffect(() => { pager.setPage(1); }, [search, filters, activeTab]);
  const pageOwners = sortedOwners.slice(pager.startIndex, pager.endIndex);
  const pageFarmers = sortedFarmers.slice(pager.startIndex, pager.endIndex);

  const allMatching = records.filter(matches);
  const total = allMatching.length;
  const activeCount = allMatching.filter((r) => getStatus(r) === "Active").length;
  const inactiveCount = allMatching.filter((r) => getStatus(r) === "Inactive").length;

  const exportSummary = [
    { label: "Total Personnel", value: String(total) },
    { label: "Active", value: String(activeCount) },
    { label: "Inactive", value: String(inactiveCount) },
  ];

  const exportMeta = {
    farmName: farmInfo.farmName,
    location: farmInfo.farmLocation,
    contact: farmInfo.farmContact,
    email: farmInfo.farmEmail,
    logoUrl: farmInfo.farmLogo
      ? (farmInfo.farmLogo.startsWith("http") ? farmInfo.farmLogo : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${farmInfo.farmLogo}`)
      : "",
    fields: filters.status !== "All" ? [{ label: "Status", value: filters.status }] : [],
  };

  const isOwnerTab = activeTab === "owner";
  const exportRows = (isOwnerTab ? owners : farmers).map((r) => ({
    "Full Name": getName(r),
    "Contact Number": getContact(r),
    "Position": getDisplayPosition(r),
    "Status": getStatus(r),
    "Remarks": getRemarks(r),
  }));

  const CHECKIN_URL =
    (typeof window !== "undefined" ? window.location.origin : "") + "/attendance/check-in";
  const STATION_QR =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    encodeURIComponent(CHECKIN_URL);

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
                <button className="pm-toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="pm-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="pm-filter-dropdown">
                    <div className="pm-filter-dropdown-header">
                      <span>Filter Records</span>
                      <button className="pm-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>

                    <div className="pm-filter-group">
                      <label className="pm-filter-label">Status</label>
                      <select
                        className="pm-filter-select"
                        value={filters.status}
                        onChange={(e) => handleFilterChange("status", e.target.value)}
                      >
                        <option value="All">All Statuses</option>
                        {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <button className="pm-toolbar-btn" onClick={() => setQrOpen(true)}><BsQrCode /> QR Generation</button>
              <ExportMenu
                rows={exportRows}
                name={`personnel-${isOwnerTab ? "owner" : "farmers"}`}
                title="Personnel Management Report"
                meta={exportMeta}
                pdfExtra={{ summary: exportSummary }}
                moduleLabel="Personnel & Manpower"
                enablePreview
                filters={{
                  ...(filters.status !== "All" ? { "Status": filters.status } : {}),
                }}
                className="pm-toolbar-btn"
              />
            </div>
          </div>
        </div>

        {error && <div className="pm-active-filters" style={{ color: "#d94f4f" }}>{error}</div>}

        {}
        {activeFilterCount > 0 && (
          <div className="pm-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value !== "All" ? (
                <span key={key} className="pm-active-filter-tag">
                  {{ status: "Status", position: "Position", shift: "Shift", task: "Task" }[key] || key}: {value}
                  <button onClick={() => handleFilterChange(key, "All")}>✕</button>
                </span>
              ) : null
            )}
          </div>
        )}

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

        <div className="pm-table-wrapper">

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
              <div className="qr-modal-title">
                <BsQrCode />
                <h3>QR Attendance</h3>
              </div>
              <button className="qr-close" onClick={() => setQrOpen(false)} aria-label="Close"><FiX /></button>
            </div>


            <div className="qr-station">
              {}
              <div className="qr-frame">
                <img className="qr-station-img" src={STATION_QR} alt="Attendance QR code" loading="lazy" />
                <span className="qr-frame-caption">Attendance QR</span>
              </div>

              {}
              <button
                className="qr-download-btn"
                onClick={() => window.open(STATION_QR, "_blank", "noopener,noreferrer")}
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