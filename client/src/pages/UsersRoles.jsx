import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiSearch, FiUsers, FiCheck, FiX, FiSlash, FiRotateCcw, FiArchive, FiMoreVertical,
  FiUserCheck, FiUserX, FiClock,
} from "react-icons/fi";
import { API_BASE } from "../api/client";
import "./UsersRoles.css";
import PageLayout from "../components/PageLayout";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import {
  usePagination, useRecordFocus, useFilterPanel, DATE_FILTER_DEFAULTS,
  localDayKey, matchesDatePeriod, dateFilterOptions, datePeriodLabel,
} from "../hooks/usePagination";
import TablePagination, {
  TableSection, TableScroll, FilterPanel, FilterSection, FilterSelect, DateFilterFields, ActiveFilterChips,
} from "../components/TablePagination";
import {
  listUsers, approveUser, rejectUser,
  activateUser, deactivateUser, archiveUser,
} from "../api/users";
import { useLanguage } from "../i18n/LanguageContext";

const STATUS = {
  Active:   { bg: "#eaf7f1", color: "#2e9e6b" },
  Inactive: { bg: "#fdf0f0", color: "#d94f4f" },
  Pending:  { bg: "#fdf3e3", color: "#c8930c" },
};
const AVATAR_COLORS = ["#E4AF1F", "#3a7bd5", "#2e9e6b", "#8257c4", "#e0892f", "#d94f4f"];
const initials = (n) => (n || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const avatarColor = (n) => AVATAR_COLORS[(n || "").length % AVATAR_COLORS.length];
const fmtDate = (s) => { const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };

// Filter defaults: Date Registered (date period) and Role.
const FILTER_DEFAULTS = { ...DATE_FILTER_DEFAULTS, role: "All" };

const TABS = [
  { key: "all", label: "All Users" },
  { key: "Pending", label: "Pending Requests" },
  { key: "Active", label: "Active Users" },
  { key: "Inactive", label: "Inactive Users" },
];

export default function UsersRoles({ embedded = false, onBack }) {
  const { t: tr } = useLanguage();
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
  const filter = useFilterPanel(FILTER_DEFAULTS);
  const fApplied = filter.applied;
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [confirmStatusChange, setConfirmStatusChange] = useState(null);
  // Approve/Reject confirmation: { user, action: "approve" | "reject" }
  const [confirmDecision, setConfirmDecision] = useState(null);
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const [openMenu, setOpenMenu] = useState(null);  const [toast, setToast] = useState("");
  const toastRef = useRef(null);
  const menuRef = useRef(null);


const refresh = async () => {
  try {
    setLoading(true);
    setError("");

    const data = await listUsers();

    setUsers(data?.users || []);
  } catch (err) {
    setUsers([]);
    setError(tr(err?.message || "Couldn't load users."));
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

  const roles = useMemo(() => [...new Set(users.map((u) => u.role).filter(Boolean))], [users]);
  const dateOptions = dateFilterOptions(users.map((u) => localDayKey(u.createdAt)), filter.draft.year);

  // createdAt is a full timestamp: compare its calendar day (local time).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const inTab = tab === "all" || u.status === tab;
      const inSearch = !q || (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
      const inRole = fApplied.role === "All" || u.role === fApplied.role;
      const inDate = matchesDatePeriod(localDayKey(u.createdAt), fApplied);
      return inTab && inSearch && inRole && inDate;
    });
  }, [users, tab, search, fApplied]);

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
  useEffect(() => { pager.setPage(1); }, [tab, search, fApplied]); // eslint-disable-line react-hooks/exhaustive-deps
  const pageRows = sorted.slice(pager.startIndex, pager.endIndex);
  // A notification's View opens this page with ?record=<user id>: show that
  // account (All tab, no search / filters if they hide it), then highlight it.
  const focus = useRecordFocus({
    rows: sorted, allRows: users, pager, ready: !loading,
    reveal: () => { setTab("all"); setSearch(""); filter.clear(); },
  });

  const activeChips = [
    fApplied.period !== "all" && { key: "date", label: "Date Registered", value: datePeriodLabel(fApplied) },
    fApplied.role !== "All" && { key: "role", label: "Role", value: fApplied.role },
  ].filter(Boolean);

  const runAction = async (fn, successMsg) => {
    try {
      await fn();
      flash(successMsg);
      refresh();
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { }
    } catch (err) {
      flash(tr(err?.message || "That action couldn't be completed. Please try again."));
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
            <input placeholder={tr("Search...")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="ur-btn-group">
            <FilterPanel panel={filter} title="Filter Users">
              <DateFilterFields panel={filter} label="Date Registered" years={dateOptions.years} months={dateOptions.months} />
              <FilterSection label="Filters">
                <FilterSelect panel={filter} field="role" label="Role" allLabel="All Roles" options={roles} />
              </FilterSection>
            </FilterPanel>
          </div>
        </div>
      </div>

      <ActiveFilterChips panel={filter} chips={activeChips} />

      {error && <div className="pb-error-banner">{error}</div>}

      <div className="ur-stats-grid">
        <div className="ur-stat-card">
          <div className="ur-stat-icon gold"><FiUsers /></div>
          <div><h3>{counts.total}</h3><p>{tr("Total Users")}</p><span>{tr("All Accounts")}</span></div>
        </div>
        {currentRole === "Owner" && (
        <div className="ur-stat-card">
          <div className="ur-stat-icon orange"><FiClock /></div>
            <div>
            <h3>{counts.Pending}</h3>
              <p>{tr("Pending Requests")}</p>
            <span>{tr("Awaiting Approval")}</span>
          </div>
        </div>
        )}
        <div className="ur-stat-card">
          <div className="ur-stat-icon green"><FiUserCheck /></div>
          <div><h3>{counts.Active}</h3><p>{tr("Active Users")}</p><span>{tr("Can Log In")}</span></div>
        </div>
        <div className="ur-stat-card">
          <div className="ur-stat-icon red"><FiUserX /></div>
          <div><h3>{counts.Inactive}</h3><p>{tr("Inactive Users")}</p><span>{tr("Disabled")}</span></div>
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
              <th className="ur-sortable-th" onClick={() => cycleSort("name")}>{tr("User")}{sortIndicator("name", sortColumn, sortDirection)}</th>
              <th className="ur-sortable-th" onClick={() => cycleSort("email")}>{tr("Email")}{sortIndicator("email", sortColumn, sortDirection)}</th>
              <th className="ur-sortable-th" onClick={() => cycleSort("role")}>{tr("Role")}{sortIndicator("role", sortColumn, sortDirection)}</th>
              <th className="ur-sortable-th" onClick={() => cycleSort("status")}>{tr("Status")}{sortIndicator("status", sortColumn, sortDirection)}</th>
              <th className="ur-sortable-th" onClick={() => cycleSort("createdAt")}>{tr("Date Registered")}{sortIndicator("createdAt", sortColumn, sortDirection)}</th>
              <th>{tr("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="ur-empty-state">{tr("Loading users...")}</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="6" className="ur-empty-state">
                  <div className="ur-empty-content">
                    <FiUsers />
                    <h3>{tr("No users found")}</h3>
                    <p>{tr("No accounts match this tab or your filters.")}</p>
                  </div>
                </td>
              </tr>
            ) : pageRows.map((u) => {
              const s = STATUS[u.status] || STATUS.Pending;

              const canManageStatus = currentRole === "Owner";
              return (
                <tr key={u._id} {...focus.rowProps(u._id)}>
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
                    <span className="ur-badge">{tr(u.role)}</span>
                  </td>
                  <td><span className="ur-badge" style={{ background: s.bg, color: s.color }}>{u.status}</span></td>
                  <td>{fmtDate(u.createdAt)}</td>
                  <td>
                    <div className="ur-actions">
                        {u.status === "Pending" && currentRole === "Owner" && (<>
                      <button className="ur-icon-btn approve" onClick={() => openDecision(u, "approve")} title={tr("Approve")} aria-label={tr("Approve")} > <FiCheck /> </button>
                      <button className="ur-icon-btn reject" onClick={() => openDecision(u, "reject")} title={tr("Reject")} aria-label={tr("Reject")} > <FiX /> </button> </>
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
                                 <FiSlash />{" "}{tr("Deactivate")}</button>
                              )}
                              
                              {u.status === "Inactive" && (
                                <button onClick={() => { setConfirmStatusChange({ user: u, action: "activate" }); setOpenMenu(null); }}>
                                  <FiRotateCcw />{" "}{tr("Activate")}</button>
                              )}
                              <button onClick={() => { setConfirmArchive(u); setOpenMenu(null); }}>
                                <FiArchive />{" "}{tr("Archive")}</button>
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
            <h3>{tr("Archive Account?")}</h3>
            <p>{tr("This will move")}{" "}<strong>"{confirmArchive.name}"</strong>{" "}{tr("to the")}{" "}<strong>{tr("Archive")}</strong>.<br />{tr("They will no longer be able to log in, but all their info is kept.")}</p>
            <div className="ur-modal-btns">
              <button className="ur-mb-cancel" onClick={() => setConfirmArchive(null)}>{tr("Cancel")}</button>
              <button className="ur-mb-confirm" onClick={doArchive}>{tr("Archive")}</button>
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
                <h3 id="ur-decision-title">{tr("Approve User")}</h3>
                <p>{tr("Are you sure you want to approve")}{" "}<strong>"{confirmDecision.user.name}"</strong>{tr("'s account?")}</p>
              </>
            ) : (
              <>
                <h3 id="ur-decision-title">{tr("Reject User")}</h3>
                <p>{tr("Are you sure you want to reject")}{" "}<strong>"{confirmDecision.user.name}"</strong>{tr("'s account? This action will update the user's approval status.")}</p>
              </>
            )}

            {decisionError && (
              <div className="pb-error-banner ur-modal-error" role="alert">{decisionError}</div>
            )}

            <div className="ur-modal-btns">
              <button className="ur-mb-cancel" onClick={closeDecision} disabled={decisionSaving}>{tr("Cancel")}</button>
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
                <h3>{tr("Deactivate Account?")}</h3>
                <p>{tr("This will disable")}{" "}<strong>"{confirmStatusChange.user.name}"</strong>{tr("'s account.")}<br />{tr("They will no longer be able to log in until reactivated.")}</p>
              </>
            ) : (
              <>
                <h3>{tr("Activate Account?")}</h3>
                <p>{tr("This will restore")}{" "}<strong>"{confirmStatusChange.user.name}"</strong>{tr("'s access.")}<br />{tr("They will be able to log in again.")}</p>
              </>
            )}
            <div className="ur-modal-btns">
              <button className="ur-mb-cancel" onClick={() => setConfirmStatusChange(null)}>{tr("Cancel")}</button>
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