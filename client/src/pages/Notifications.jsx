import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../hooks/useUser";
import { FARMER_ALLOWED_CATEGORIES } from "../notifStore";
import {
  FiSearch, FiBell, FiCheck, FiCheckCircle, FiTrash2, FiChevronRight,
  FiAlertTriangle, FiCalendar,
} from "react-icons/fi";
import "./Notifications.css";
import PageLayout from "../components/PageLayout";

/* ── Category meta (icon + label + redirect route) ── */
const CATEGORIES = {
  egg:        { label: "Egg Production",  icon: "🥚", redirect: "/records/egg" },
  sales:      { label: "Sales",           icon: "💰", redirect: "/sales-transactions/sales" },
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
};

/* ── Mock notifications (replace with API data later) ── */
const now = Date.now();
const min = 60 * 1000, hr = 60 * min, day = 24 * hr;

const SEED = [
  // ── ALERTS ──
  { id: "n1",  type: "alert", category: "mortality", priority: "high",   read: false, dateTime: now - 12 * min, title: "High Mortality Detected", description: "Batch B-014 mortality reached 10% today. Immediate review required." },
  { id: "n2",  type: "alert", category: "health",    priority: "high",   read: false, dateTime: now - 40 * min, title: "Disease Detected", description: "New diagnosis recorded: suspected Newcastle disease in Batch B-009." },
  { id: "n3",  type: "alert", category: "feed",      priority: "high",   read: false, dateTime: now - 1 * hr,  title: "Critical Feed Inventory", description: "Layer Pellets will last approximately 5 more days. Restocking is recommended." },
  { id: "n4",  type: "alert", category: "visitor",   priority: "high",   read: false, dateTime: now - 2 * hr,  title: "Biosecurity Risk Visitor", description: "Ramon Cruz answered YES to visiting another farm within 7 days. Marked as biosecurity risk." },
  { id: "n5",  type: "alert", category: "egg",       priority: "medium", read: false, dateTime: now - 3 * hr,  title: "Low Hen-Day Production", description: "Hen-Day Production fell to 76% — below the 80% threshold." },
  { id: "n6",  type: "alert", category: "egg",       priority: "medium", read: true,  dateTime: now - 5 * hr,  title: "Egg Production Drop", description: "Hen-Day Production decreased by 3.4% compared to yesterday." },
  { id: "n7",  type: "alert", category: "egg",       priority: "medium", read: false, dateTime: now - 6 * hr,  title: "Daily Egg Record Not Submitted", description: "Today's egg record has not yet been submitted." },
  { id: "n8",  type: "alert", category: "sales",     priority: "medium", read: true,  dateTime: now - 8 * hr,  title: "Sales Decrease", description: "Daily sales dropped 22% versus the 7-day average." },
  { id: "n9",  type: "alert", category: "sales",     priority: "high",   read: false, dateTime: now - 10 * hr, title: "Net Loss Detected", description: "Yesterday's transactions resulted in a net loss of ₱1,240." },
  { id: "n10", type: "alert", category: "feed",      priority: "medium", read: true,  dateTime: now - 12 * hr, title: "Low Feed Stock", description: "Estimated feed supply is less than 14 days for Starter Mash." },
  { id: "n11", type: "alert", category: "mortality", priority: "medium", read: false, dateTime: now - 14 * hr, title: "Mortality Threshold Reached", description: "Batch B-006 mortality reached 5%." },
  { id: "n12", type: "alert", category: "isolation", priority: "medium", read: true,  dateTime: now - 20 * hr, title: "New Isolation Case", description: "A chicken from Batch B-011 was placed under isolation." },
  { id: "n13", type: "alert", category: "personnel", priority: "medium", read: false, dateTime: now - 1 * day, title: "Task Overdue", description: "Assigned task 'Clean coop section C' for Juan D. is now overdue." },
  { id: "n14", type: "alert", category: "users",     priority: "medium", read: false, dateTime: now - 1 * day - 3 * hr, title: "Pending Farmer Approval", description: "A new Farmer account is waiting for admin approval." },

  // ── REMINDERS ──
  { id: "n15", type: "reminder", category: "age",        priority: "low", read: false, dateTime: now - 2 * hr,          title: "Culling Reminder — Approaching", description: "Batch B-002 reached 95 weeks. Prepare for culling or replacement soon." },
  { id: "n16", type: "reminder", category: "age",        priority: "low", read: true,  dateTime: now - 1 * day,         title: "Recommended for Culling", description: "Batch B-001 reached 104 weeks (2 years) and is recommended for culling." },
  { id: "n17", type: "reminder", category: "age",        priority: "low", read: false, dateTime: now - 2 * day,         title: "Overage Active Flock", description: "Batch B-000 exceeded 104 weeks but is still marked Active." },
  { id: "n18", type: "reminder", category: "quarantine", priority: "low", read: false, dateTime: now - 5 * hr,          title: "Quarantine Complete", description: "Batch Q-03 quarantine period is complete and ready for release." },
  { id: "n19", type: "reminder", category: "health",     priority: "low", read: true,  dateTime: now - 1 * day - 6 * hr, title: "Vaccination Reminder", description: "Scheduled vaccination for Batch B-007 is due tomorrow." },
];

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < hr) return `${Math.max(1, Math.floor(diff / min))}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  const d = Math.floor(diff / day);
  return d === 1 ? "Yesterday" : `${d}d ago`;
}
function fullDate(ts) {
  return new Date(ts).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}
const prioText = (p) => (p === "high" ? "🔴 High" : p === "medium" ? "🟡 Medium" : "🔵 Low");

/* ── localStorage wiring: merges module-pushed notifications (pb_notifications)
      written by Users & Roles, alerts, etc. Keeps the same design/shape. ── */
const N_KEY = "pb_notifications";
const readStore = () => { try { const a = JSON.parse(localStorage.getItem(N_KEY)); return Array.isArray(a) ? a : []; } catch { return []; } };
const writeStore = (a) => { try { localStorage.setItem(N_KEY, JSON.stringify(a)); } catch { /* ignore */ } try { window.dispatchEvent(new Event("pb_notifs_changed")); } catch { /* ignore */ } };

function normalize(n) {
  if (n.type && n.dateTime && (n.category || n.description)) return n; // already full shape
  const title = n.title || "";
  const t = title.toLowerCase();
  let category = "users";
  if (/egg/.test(t)) category = "egg";
  else if (/feed/.test(t)) category = "feed";
  else if (/mortalit/.test(t)) category = "mortality";
  else if (/health|diagnos|vaccin/.test(t)) category = "health";
  else if (/visitor/.test(t)) category = "visitor";
  else if (/personnel|task/.test(t)) category = "personnel";
  else if (/isolat/.test(t)) category = "isolation";
  else if (/quarantine/.test(t)) category = "quarantine";
  else if (/sale/.test(t)) category = "sales";
  return {
    id: n.id || "n_" + Date.now() + "_" + Math.floor(Math.random() * 9999),
    type: n.type === "reminder" ? "reminder" : "alert",
    category,
    priority: n.priority || "medium",
    read: !!n.read,
    dateTime: n.dateTime || (n.at ? Date.parse(n.at) : Date.now()),
    title,
    description: n.description || n.message || "",
  };
}

function loadItems() {
  // No demo/mock notifications — start empty; only real events populate this.
  return readStore().map(normalize);
}

export default function Notifications() {
  const navigate = useNavigate();
  const { role } = useUser();
  const [items, setItems] = useState(loadItems);
  const [tab, setTab] = useState("alert");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("all");

  // pick up new notifications pushed by other pages (e.g. after Approve in Users & Roles)
  useEffect(() => {
    const refresh = () => setItems(readStore().map(normalize));
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("storage", refresh); };
  }, []);

  const persist = (next) => { writeStore(next); setItems(next); };

  // Farmers only see operational notifications (no Sales, Expenses,
  // Visitors, Personnel, User Management / admin notifications) — this list
  // lives in notifStore.js so the Dashboard Alert Card uses the exact same
  // rule and the two never drift out of sync.
  const FARMER_ALLOWED = FARMER_ALLOWED_CATEGORIES;
  const allowedItems = role === "Farmer" ? items.filter((n) => FARMER_ALLOWED.includes(n.category)) : items;

  const unreadAlerts = allowedItems.filter((n) => n.type === "alert" && !n.read).length;
  const unreadReminders = allowedItems.filter((n) => n.type === "reminder" && !n.read).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allowedItems
      .filter((n) => n.type === tab)
      .filter((n) => (categoryFilter === "all" ? true : n.category === categoryFilter))
      .filter((n) => (readFilter === "all" ? true : readFilter === "unread" ? !n.read : n.read))
      .filter((n) => (!q ? true : (n.title + " " + n.description).toLowerCase().includes(q)))
      .sort((a, b) => b.dateTime - a.dateTime);
  }, [allowedItems, tab, search, categoryFilter, readFilter]);

  const markRead = (id) => persist(items.map((n) => (n.id === id ? { ...n, read: true } : n)));
  const markAllRead = () =>
    persist(items.map((n) =>
      (n.type === tab && (role !== "Farmer" || FARMER_ALLOWED.includes(n.category)) ? { ...n, read: true } : n)
    ));
  const remove = (id) => persist(items.filter((n) => n.id !== id));
  const openNotif = (n) => { markRead(n.id); const r = CATEGORIES[n.category]?.redirect; if (r) navigate(r); };

  const tabCategories = [...new Set(allowedItems.filter((n) => n.type === tab).map((n) => n.category))];

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[{ label: "NOTIFICATIONS" }]}
    >

        {/* Tabs */}
        <div className="nt-tabs">
          <button className={`nt-tab ${tab === "alert" ? "active" : ""}`} onClick={() => setTab("alert")}>
            <FiAlertTriangle /> Alerts {unreadAlerts > 0 && <span className="nt-tab-count">{unreadAlerts}</span>}
          </button>
          <button className={`nt-tab ${tab === "reminder" ? "active" : ""}`} onClick={() => setTab("reminder")}>
            <FiCalendar /> Reminders {unreadReminders > 0 && <span className="nt-tab-count">{unreadReminders}</span>}
          </button>
        </div>

        {/* Toolbar */}
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
              {tabCategories.map((c) => (<option key={c} value={c}>{CATEGORIES[c].icon} {CATEGORIES[c].label}</option>))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="nt-table">
          <div className="nt-thead">
            <span>Notification</span>
            <span>Priority</span>
            <span>Date &amp; Time</span>
            <span>Status</span>
            <span></span>
          </div>

          {visible.length === 0 && (
            <div className="nt-empty">
              <FiBell />
              <h3>No {tab === "alert" ? "alerts" : "reminders"} found</h3>
              <p>You're all caught up. New {tab === "alert" ? "alerts" : "reminders"} will appear here.</p>
            </div>
          )}

          {visible.map((n) => {
            const cat = CATEGORIES[n.category];
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