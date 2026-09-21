import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../hooks/useUser";
import {
  FARMER_ALLOWED_CATEGORIES, refresh as refreshNotifs, getCached as getCachedNotifs,
  getLastError, subscribe as subscribeNotifs,
  markNotificationRead, markAllNotificationsRead, deleteNotification,
} from "../notifStore";
import {
  FiSearch, FiBell, FiCheck, FiCheckCircle, FiTrash2, FiChevronRight,
  FiAlertTriangle, FiCalendar,
} from "react-icons/fi";
import "./Notifications.css";
import PageLayout from "../components/PageLayout";

const CATEGORIES = {
  egg:        { label: "Egg Production",  icon: "🥚", redirect: "/records/egg" },
  sales:      { label: "Sales",           icon: "💰", redirect: "/sales-transactions/sales" },
  expense:    { label: "Expenses",        icon: "💸", redirect: "/sales-transactions/expenses" },
  feed:       { label: "Feed Inventory",  icon: "🌾", redirect: "/inventory/feed-inventory" },
  mortality:  { label: "Mortality",       icon: "☠️", redirect: "/records/mortality" },
  health:     { label: "Health",          icon: "💊", redirect: "/records/health" },
  isolation:  { label: "Isolation",       icon: "🚨", redirect: "/records/quarantine" },
  quarantine: { label: "Quarantine",      icon: "🐣", redirect: "/records/quarantine" },
  equipment:  { label: "Equipment",       icon: "🛠️", redirect: "/inventory/equipment" },
  age:        { label: "Age Reminder",    icon: "📅", redirect: "/records/flock" },
  personnel:  { label: "Personnel",       icon: "👥", redirect: "/personnel-visitors/personnel" },
  visitor:    { label: "Visitor",         icon: "🚶", redirect: "/personnel-visitors/visitors" },
  users:      { label: "Users and Roles", icon: "👤", redirect: "/users-roles" },
  task:       { label: "Task",            icon: "📋", redirect: null },  todo:       { label: "To-Do",           icon: "📋", redirect: null },};

const min = 60 * 1000, hr = 60 * min, day = 24 * hr;

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < hr) return `${Math.max(1, Math.floor(diff / min))}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  const d = Math.floor(diff / day);
  return d === 1 ? "Yesterday" : `${d}d ago`;
}
function fullDate(ts) {
  return new Date(ts).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}
const prioText = (p) => (p === "critical" ? "🔴 Critical" : p === "warning" ? "🟡 Warning" : "🔵 Normal");

export default function Notifications() {
  const navigate = useNavigate();
  const { role } = useUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("alert");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("all");

  const fetchNotifications = async () => {
    setLoading(true);
    await refreshNotifs(role);
    setItems(getCachedNotifs(role));
    setError(getLastError()?.message || "");
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    const update = () => setItems(getCachedNotifs(role));
    return subscribeNotifs(update);
  }, [role]);

  const allowedItems = role === "Farmer" ? items.filter((n) => FARMER_ALLOWED_CATEGORIES.includes(n.category)) : items;
  console.log("Role:", role);
  console.log("Items:", items);
  console.log("Allowed Items:", allowedItems);

  const unreadAlerts = allowedItems.filter((n) => n.type === "alert" && !n.read).length;
  const unreadReminders = allowedItems.filter((n) => n.type === "reminder" && !n.read).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    console.log("Tab:", tab);
    console.log("Visible source:", allowedItems);
    return allowedItems
      .filter((n) => n.type === tab)
      .filter((n) => (categoryFilter === "all" ? true : n.category === categoryFilter))
      .filter((n) => (readFilter === "all" ? true : readFilter === "unread" ? !n.read : n.read))
      .filter((n) => (!q ? true : (n.title + " " + n.description).toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
  }, [allowedItems, tab, search, categoryFilter, readFilter]);

  const markRead = async (id) => { await markNotificationRead(id); setItems(getCachedNotifs(role)); };
  const markAllRead = async () => { await markAllNotificationsRead(); setItems(getCachedNotifs(role)); };
  const remove = async (id) => { await deleteNotification(id); setItems(getCachedNotifs(role)); };
  const openNotif = (n) => {
    markRead(n.id);
    if (n.category === "task" || n.category === "todo") {
      const todoPath = role === "Farmer" ? "/todo" : "/owner/todo";
      navigate(n.referenceId ? `${todoPath}?task=${n.referenceId}` : todoPath);
      return;
    }
    const r = CATEGORIES[n.category]?.redirect;
    if (r) navigate(r);
  };

  const tabCategories = [...new Set(allowedItems.filter((n) => n.type === tab).map((n) => n.category))];

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[{ label: "NOTIFICATIONS" }]}
    >

        {}
        <div className="nt-tabs">
          <button className={`nt-tab ${tab === "alert" ? "active" : ""}`} onClick={() => setTab("alert")}>
            <FiAlertTriangle /> Alerts {unreadAlerts > 0 && <span className="nt-tab-count">{unreadAlerts}</span>}
          </button>
          <button className={`nt-tab ${tab === "reminder" ? "active" : ""}`} onClick={() => setTab("reminder")}>
            <FiCalendar /> Reminders {unreadReminders > 0 && <span className="nt-tab-count">{unreadReminders}</span>}
          </button>
        </div>

        {}
        <div className="nt-toolbar">
          <div className="nt-search">
            <FiSearch />
            <input placeholder="Search notifications..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="nt-filters">
            <div className="nt-segment">
              {["all", "unread", "read"].map((r) => (
                <button key={r} className={readFilter === r ? "active" : ""} onClick={() => setReadFilter(r)}>
                  {r === "all" ? "All" : r === "unread" ? "Unread" : "Read"}
                </button>
              ))}
            </div>
            <button className="nt-markall" onClick={markAllRead} disabled={(tab === "alert" ? unreadAlerts : unreadReminders) === 0}>
              <FiCheckCircle /> Mark all as read
            </button>
            <select className="nt-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All categories</option>
              {tabCategories.map((c) => (<option key={c} value={c}>{CATEGORIES[c]?.icon} {CATEGORIES[c]?.label}</option>))}
            </select>
          </div>
        </div>

        {error && <div className="nt-empty" style={{ padding: "12px 0" }}><p style={{ color: "#d94f4f" }}>{error}</p></div>}

        {}
        <div className="nt-table">
          <div className="nt-thead">
            <span>Notification</span>
            <span>Priority</span>
            <span>Date &amp; Time</span>
            <span>Status</span>
            <span></span>
          </div>

          {loading && (
            <div className="nt-empty">
              <FiBell />
              <h3>Loading…</h3>
            </div>
          )}

          {!loading && visible.length === 0 && (
            <div className="nt-empty">
              <FiBell />
              <h3>No {tab === "alert" ? "alerts" : "reminders"} found</h3>
              <p>You're all caught up. New {tab === "alert" ? "alerts" : "reminders"} will appear here.</p>
            </div>
          )}

          {!loading && visible.map((n) => {
            const cat = CATEGORIES[n.category] || { icon: "🔔", label: n.category || "General" };
            return (
              <div key={n.id} className={`nt-row ${n.read ? "read" : "unread"} prio-${n.priority}`}>
                <div className="nt-cell-main">
                  <div className="nt-cat-icon">{cat.icon}</div>
                  <div className="nt-cell-text">
                    <h4>{!n.read && <span className="nt-dot" />}{n.title}</h4>
                    <p>{n.description}</p>
                    <span className="nt-source">{cat.icon} {cat.label}</span>
                  </div>
                </div>

                <div className="nt-cell" data-label="Priority">
                  <span className={`nt-prio prio-${n.priority}`}>{prioText(n.priority)}</span>
                </div>

                <div className="nt-cell nt-datetime" data-label="Date & Time">
                  <span>{timeAgo(n.dateTime)}</span>
                  <small>{fullDate(n.dateTime)}</small>
                </div>

                <div className="nt-cell" data-label="Status">
                  <span className={`nt-status ${n.read ? "read" : "unread"}`}>{n.read ? "Read" : "Unread"}</span>
                </div>

                <div className="nt-cell nt-actions">
                  <button className="nt-view" onClick={() => openNotif(n)} title="View">View <FiChevronRight /></button>
                  {!n.read && <button className="nt-icon-btn" onClick={() => markRead(n.id)} title="Mark as read"><FiCheck /></button>}
                  <button className="nt-icon-btn danger" onClick={() => remove(n.id)} title="Delete"><FiTrash2 /></button>
                </div>
              </div>
            );
          })}
        </div>

    </PageLayout>
  );
}