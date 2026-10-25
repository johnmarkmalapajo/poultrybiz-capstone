import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiSearch, FiUsers, FiCheck, FiX, FiSlash, FiRotateCcw, FiArchive, FiMoreVertical,
  FiUserCheck, FiUserX, FiClock, FiFilter,
} from "react-icons/fi";
import { API_BASE } from "../api/client";
import "./UsersRoles.css";
import PageLayout from "../components/PageLayout";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination, { TableSection, TableScroll } from "../components/TablePagination";
import {
  listUsers, approveUser, rejectUser,
  activateUser, deactivateUser, archiveUser,
} from "../api/users";

const STATUS = {
  Active:   { bg: "#eaf7f1", color: "#2e9e6b" },
  Inactive: { bg: "#fdf0f0", color: "#d94f4f" },
  Pending:  { bg: "#fdf3e3", color: "#c8930c" },
};
const AVATAR_COLORS = ["#E4AF1F", "#3a7bd5", "#2e9e6b", "#8257c4", "#e0892f", "#d94f4f"];
const initials = (n) => (n || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const avatarColor = (n) => AVATAR_COLORS[(n || "").length % AVATAR_COLORS.length];
const fmtDate = (s) => { const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };

const TABS = [
  { key: "all", label: "All Users" },
  { key: "Pending", label: "Pending Requests" },
  { key: "Active", label: "Active Users" },
  { key: "Inactive", label: "Inactive Users" },
];

export default function UsersRoles({ embedded = false, onBack }) {
  const navigate = useNavigate();

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentRole = currentUser.role;

  const visibleTabs =
  currentRole === "Owner"
    ? TABS
    : TABS.filter((t) => t.key !== "Pending");

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [fRole, setFRole] = useState("All");
  const [fDate, setFDate] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [confirmStatusChange, setConfirmStatusChange] = useState(null);
  // Approve/Reject confirmation: { user, action: "approve" | "reject" }
  const [confirmDecision, setConfirmDecision] = useState(null);
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const [openMenu, setOpenMenu] = useState(null);  const [toast, setToast] = useState("");
  const toastRef = useRef(null);
  const filterRef = useRef(null);
  const menuRef = useRef(null);


const refresh = async () => {
  try {
    setLoading(true);
    setError("");

    const data = await listUsers();

    setUsers(data?.users || []);
  } catch (err) {
    setUsers([]);
    setError(err?.message || "Couldn't load users.");
  } finally {
    setLoading(false);
  }
};
  useEffect(() => {
    refresh();
    window.addEventListener("pb_data_changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("pb_data_changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => () => clearTimeout(toastRef.current), []);
  useEffect(() => {
  const onClick = (e) => {
    if (filterRef.current && !filterRef.current.contains(e.target)) {
      setShowFilter(false);
    }

    if (!e.target.closest(".ur-menu-wrap")) {
      setOpenMenu(null);
    }
  };

  document.addEventListener("mousedown", onClick);

  return () => document.removeEventListener("mousedown", onClick);
}, []);

  const flash = (m) => { setToast(m); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(""), 3000); };

  const counts = useMemo(() => ({
    total: users.length,
    Pending: users.filter((u) => u.status === "Pending").length,
    Active: users.filter((u) => u.status === "Active").length,
    Inactive: users.filter((u) => u.status === "Inactive").length,
  }), [users]);

  const roles = useMemo(() => [...new Set(users.map((u) => u.role))], [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const inTab = tab === "all" || u.status === tab;
      const inSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const inRole = fRole === "All" || u.role === fRole;
      const inDate = !fDate || u.createdAt === fDate;
      return inTab && inSearch && inRole && inDate;
    });
  }, [users, tab, search, fRole, fDate]);

  const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
  const sortAccessor = (row, col) => {
    if (col === "name") return row.name || "";
    if (col === "email") return row.email || "";
    if (col === "role") return row.role || "";
    if (col === "status") return row.status || "";
    if (col === "createdAt") return row.createdAt || "";
    return "";
  };
  const sorted = sortData(filtered, sortAccessor);
  const pager = usePagination(sorted.length);
  useEffect(() => { pager.setPage(1); }, [tab, search, fRole, fDate]);
  const pageRows = sorted.slice(pager.startIndex, pager.endIndex);

  const activeFilters = [
    fRole !== "All" && { key: "Role", value: fRole, clear: () => setFRole("All") },
    fDate && { key: "Date", value: fDate, clear: () => setFDate("") },
  ].filter(Boolean);
  const activeFilterCount = activeFilters.length;
  const clearFilters = () => { setFRole("All"); setFDate(""); };

  const runAction = async (fn, successMsg) => {
    try {
      await fn();
      flash(successMsg);
      refresh();
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { }
    } catch (err) {
      flash(err?.message || "That action couldn't be completed. Please try again.");
    }
  };

  const openDecision = (user, action) => {
    setDecisionError("");
    setConfirmDecision({ user, action });
  };

  const closeDecision = () => {
    if (decisionSaving) return;
    setConfirmDecision(null);
    setDecisionError("");
  };

  // Sends the existing approve/reject request. The list is refreshed from the
  // backend only after it succeeds; on failure the modal stays open with the
  // error so the Owner can retry or cancel.
  const submitDecision = async () => {
    const decision = confirmDecision;
    if (!decision || decisionSaving) return;

    const { user, action } = decision;
    const isApprove = action === "approve";

    setDecisionSaving(true);
    setDecisionError("");

    try {
      if (isApprove) {
        await approveUser(user._id);
      } else {
        await rejectUser(user._id);
      }

      setConfirmDecision(null);
      flash(isApprove ? `Approved ${user.name}` : `Rejected ${user.name}`);
      refresh();
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { /* ignore */ }
    } catch (err) {
      setDecisionError(
        err?.message ||
          `Couldn't ${isApprove ? "approve" : "reject"} this account. Please try again.`
      );
    } finally {
      setDecisionSaving(false);
    }
  };

  useEffect(() => {
    if (!confirmDecision) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !decisionSaving) {
        setConfirmDecision(null);
        setDecisionError("");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDecision, decisionSaving]);

  const deactivate = (u) => runAction(() => deactivateUser(u._id), `Deactivated ${u.name}`);
  const activate   = (u) => runAction(() => activateUser(u._id), `Activated ${u.name}`);
  const archive    = (u) => runAction( () => archiveUser(u._id), `Archived ${u.name}` );

  const doArchive = () => {
    const u = confirmArchive; if (!u) return;
    setConfirmArchive(null);
    runAction(() => archiveUser(u._id), `Archived ${u.name}`);
  };

  const doStatusChange = () => {
    const cs = confirmStatusChange; if (!cs) return;
    setConfirmStatusChange(null);
    if (cs.action === "deactivate") deactivate(cs.user);
    else activate(cs.user);
  };

  const content = (
    <>
      <div className="ur-toolbar">
        <div className="ur-toolbar-right">
          <div className="ur-search-box">
            <FiSearch />
            <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="ur-btn-group">
            <div className="ur-filter-wrap" ref={filterRef}>
              <button className="ur-toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                <FiFilter /> Filter
                {activeFilterCount > 0 && <span className="ur-filter-count">{activeFilterCount}</span>}
              </button>

              {showFilter && (
                <div className="ur-filter-dropdown">
                  <div className="ur-filter-dropdown-header">
                    <span>Filter Users</span>
                    <button className="ur-filter-clear" onClick={clearFilters}>Clear All</button>
                  </div>
                  <div className="ur-filter-group">
                    <label className="ur-filter-label">Role</label>
                    <select className="ur-filter-select" value={fRole} onChange={(e) => setFRole(e.target.value)}>
                      <option value="All">All Roles</option>
                      {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="ur-filter-group">
                    <label className="ur-filter-label">Date Registered</label>
                    <input className="ur-filter-select" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="ur-active-filters">
          {activeFilters.map((f) => (
            <span key={f.key} className="ur-active-filter-tag">
              {f.key}: {f.value}
              <button onClick={f.clear}>✕</button>
            </span>
          ))}
        </div>
      )}

      {error && <div className="pb-error-banner">{error}</div>}

      <div className="ur-stats-grid">
        <div className="ur-stat-card">
          <div className="ur-stat-icon gold"><FiUsers /></div>
          <div><h3>{counts.total}</h3><p>Total Users</p><span>All Accounts</span></div>
        </div>
        {currentRole === "Owner" && (
        <div className="ur-stat-card">
          <div className="ur-stat-icon orange"><FiClock /></div>
            <div>
            <h3>{counts.Pending}</h3>
              <p>Pending Requests</p>
            <span>Awaiting Approval</span>
          </div>
        </div>
        )}
        <div className="ur-stat-card">
          <div className="ur-stat-icon green"><FiUserCheck /></div>
          <div><h3>{counts.Active}</h3><p>Active Users</p><span>Can Log In</span></div>
        </div>
        <div className="ur-stat-card">
          <div className="ur-stat-icon red"><FiUserX /></div>
          <div><h3>{counts.Inactive}</h3><p>Inactive Users</p><span>Disabled</span></div>
        </div>
      </div>

      <div className="ur-tabs">
        {visibleTabs.map((t) => {
          const n = t.key === "all" ? counts.total : counts[t.key];
          return (
            <button key={t.key} className={`ur-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label} <span className="count">{n}</span>
            </button>
          );
        })}
      </div>

      <TableSection className="ur-table-wrapper">
        <TableScroll>
        <table className="ur-table">
          <thead>
            <tr>
              <th className="ur-sortable-th" onClick={() => cycleSort("name")}>User{sortIndicator("name", sortColumn, sortDirection)}</th>
              <th className="ur-sortable-th" onClick={() => cycleSort("email")}>Email{sortIndicator("email", sortColumn, sortDirection)}</th>
              <th className="ur-sortable-th" onClick={() => cycleSort("role")}>Role{sortIndicator("role", sortColumn, sortDirection)}</th>
              <th className="ur-sortable-th" onClick={() => cycleSort("status")}>Status{sortIndicator("status", sortColumn, sortDirection)}</th>
              <th className="ur-sortable-th" onClick={() => cycleSort("createdAt")}>Date Registered{sortIndicator("createdAt", sortColumn, sortDirection)}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="ur-empty-state">Loading users...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="6" className="ur-empty-state">
                  <div className="ur-empty-content">
                    <FiUsers />
                    <h3>No users found</h3>
                    <p>No accounts match this tab or your filters.</p>
                  </div>
                </td>
              </tr>
            ) : pageRows.map((u) => {
              const s = STATUS[u.status] || STATUS.Pending;

              const canManageStatus = currentRole === "Owner";
              return (
                <tr key={u._id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <div className="ur-avatar" style={{ background: avatarColor(u.name) }}>
                        {u.avatar ? <img src={`${API_BASE}${u.avatar}`} alt={u.name} /> : initials(u.name)}
                      </div>
                      <span className="ur-name">{u.name}</span>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className="ur-badge">{u.role}</span>
                  </td>
                  <td><span className="ur-badge" style={{ background: s.bg, color: s.color }}>{u.status}</span></td>
                  <td>{fmtDate(u.createdAt)}</td>
                  <td>
                    <div className="ur-actions">
                        {u.status === "Pending" && currentRole === "Owner" && (<>
                      <button className="ur-icon-btn approve" onClick={() => openDecision(u, "approve")} title="Approve" aria-label="Approve" > <FiCheck /> </button>
                      <button className="ur-icon-btn reject" onClick={() => openDecision(u, "reject")} title="Reject" aria-label="Reject" > <FiX /> </button> </>
                    )}         
                      {(u.status === "Active" || u.status === "Inactive") &&
                         canManageStatus && (
                        <div className="ur-menu-wrap">
                          <button className="ur-menu-trigger" onClick={() => setOpenMenu(openMenu === u._id ? null : u._id)}>
                            <FiMoreVertical />
                          </button>
                          {openMenu === u._id && (
                            <div className="ur-menu-dropdown" ref={menuRef}>
                              {u.status === "Active" && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmStatusChange({ user: u, action: "deactivate" }); setOpenMenu(null); }}
                                >
                                 <FiSlash /> Deactivate
                               </button>
                              )}
                              
                              {u.status === "Inactive" && (
                                <button onClick={() => { setConfirmStatusChange({ user: u, action: "activate" }); setOpenMenu(null); }}>
                                  <FiRotateCcw /> Activate
                                </button>
                              )}
                              <button onClick={() => { setConfirmArchive(u); setOpenMenu(null); }}>
                                <FiArchive /> Archive
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
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

      {toast && <div className="ur-toast">{toast}</div>}

      {confirmArchive && (
        <div className="ur-overlay" onClick={() => setConfirmArchive(null)}>
          <div className="ur-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Archive Account?</h3>
            <p>This will move <strong>"{confirmArchive.name}"</strong> to the <strong>Archive</strong>.<br />They will no longer be able to log in, but all their info is kept.</p>
            <div className="ur-modal-btns">
              <button className="ur-mb-cancel" onClick={() => setConfirmArchive(null)}>Cancel</button>
              <button className="ur-mb-confirm" onClick={doArchive}>Archive</button>
            </div>
          </div>
        </div>
      )}

      {confirmDecision && (
        <div className="ur-overlay" onClick={closeDecision}>
          <div
            className="ur-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ur-decision-title"
            onClick={(e) => e.stopPropagation()}
          >
            {confirmDecision.action === "approve" ? (
              <>
                <h3 id="ur-decision-title">Approve User</h3>
                <p>
                  Are you sure you want to approve <strong>"{confirmDecision.user.name}"</strong>'s account?
                </p>
              </>
            ) : (
              <>
                <h3 id="ur-decision-title">Reject User</h3>
                <p>
                  Are you sure you want to reject <strong>"{confirmDecision.user.name}"</strong>'s account? This action will update the user's approval status.
                </p>
              </>
            )}

            {decisionError && (
              <div className="pb-error-banner ur-modal-error" role="alert">{decisionError}</div>
            )}

            <div className="ur-modal-btns">
              <button className="ur-mb-cancel" onClick={closeDecision} disabled={decisionSaving}>
                Cancel
              </button>
              <button
                className={`ur-mb-confirm ${confirmDecision.action === "approve" ? "approve" : "reject"}`}
                onClick={submitDecision}
                disabled={decisionSaving}
                aria-busy={decisionSaving}
              >
                {decisionSaving
                  ? confirmDecision.action === "approve" ? "Approving..." : "Rejecting..."
                  : confirmDecision.action === "approve" ? "Confirm Approval" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmStatusChange && (
        <div className="ur-overlay" onClick={() => setConfirmStatusChange(null)}>
          <div className="ur-modal" onClick={(e) => e.stopPropagation()}>
            {confirmStatusChange.action === "deactivate" ? (
              <>
                <h3>Deactivate Account?</h3>
                <p>This will disable <strong>"{confirmStatusChange.user.name}"</strong>'s account.<br />They will no longer be able to log in until reactivated.</p>
              </>
            ) : (
              <>
                <h3>Activate Account?</h3>
                <p>This will restore <strong>"{confirmStatusChange.user.name}"</strong>'s access.<br />They will be able to log in again.</p>
              </>
            )}
            <div className="ur-modal-btns">
              <button className="ur-mb-cancel" onClick={() => setConfirmStatusChange(null)}>Cancel</button>
              <button className="ur-mb-confirm" onClick={doStatusChange}>
                {confirmStatusChange.action === "deactivate" ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "SETTINGS", path: "/settings" },
        { label: "USERS & ROLES" },
      ]}
    >
      {content}
    </PageLayout>
  );
}