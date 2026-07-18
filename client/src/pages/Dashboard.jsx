import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  PieChart, Pie, Cell, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from "recharts";
import PageLayout from "../components/PageLayout";
import Card, { Icons } from "../components/Card";
import { useUser } from "../hooks/useUser";
import { getAll as getNotifications, subscribe as subscribeNotifs } from "../notifStore";
import "./Dashboard.css";

const BASE_URL = "https://poultrybiz.onrender.com/api/v1";

const EGG_COLORS = ["#f5d76e","#f5a623","#f0a070","#d4a0e0","#a0c4f0","#70b8d4","#a0d4b0"];
const EGG_LABELS = ["Large","Extra Large","Medium","Jumbo","Small","Peewee","Crack"];
const EGG_KEYS   = ["large","extraLarge","medium","jumbo","small","peewee","crack"];

const EMPTY = {
  flock:      { currentFlockSize: 0, productiveRate: 0, mortalityRate: 0 },
  eggs:       { totalEggsToday: 0, sizeDistribution: {}, dailyTrend: [] },
  financials: { salesRevenue: 0, totalExpenses: 0, netProfitLoss: 0 },
  feedStockKg: 0,
  tasks:      [],
  alerts:     [],
};

// Same key AdminTodo.jsx writes to — reading it directly (instead of a dead
// API endpoint) keeps the Dashboard's To Do card in sync with real tasks.
const ADMIN_TODO_KEY = "pb_admin_todos";
function loadAdminTasks() {
  try {
    const raw = localStorage.getItem(ADMIN_TODO_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return list
      .filter((t) => !t.archived)
      .map((t) => ({ _id: t.id, date: t.due, task: t.title, isCompleted: t.status === "Completed" }));
  } catch {
    return [];
  }
}

// Notifications (Sidebar badge's source of truth) double as the Dashboard's
// Alert feed — unread alerts/reminders, most recent first.
function loadDashboardAlerts() {
  return getNotifications()
    .filter((n) => !n.read)
    .sort((a, b) => b.dateTime - a.dateTime)
    .map((n) => ({ type: n.priority === "high" ? "danger" : "warning", message: n.title }));
}

// Always returns a fully-shaped dashboard object, even if the API sends
// partial data, an array, null, or nothing — so the UI can never crash.
function shapeData(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return EMPTY;
  return {
    ...EMPTY,
    ...d,
    flock:      { ...EMPTY.flock,      ...(d.flock      || {}) },
    eggs:       { ...EMPTY.eggs,       ...(d.eggs       || {}) },
    financials: { ...EMPTY.financials, ...(d.financials || {}) },
    tasks:      Array.isArray(d.tasks)  ? d.tasks  : [],
    alerts:     Array.isArray(d.alerts) ? d.alerts : [],
  };
}

function Dashboard() {
  const [data, setData]       = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [tasks, setTasks]     = useState([]);

  const { user, role, canSeeFinancials, canViewPersonnel } = useUser();
  const navigate = useNavigate();
  const TODO_LIMIT = 5;
  const ALERT_LIMIT = 4;
  const isNewUser = localStorage.getItem("isNewUser") === "true";

  // ── Cards with beautiful SVG icons (all values guarded with ?. and ?? 0) ──
  const ALL_CARDS = [
    {
      title:     "Current Flock Size",
      value:     data.flock?.currentFlockSize ?? 0,
      icon:      Icons.flock,
      iconBg:    "#fff3e0",
      adminOnly: false,
    },
    {
      title:     "Sales Revenue",
      value:     data.financials?.salesRevenue ?? 0,
      icon:      Icons.revenue,
      iconBg:    "#fff8e1",
      adminOnly: true,
    },
    {
      title:     "Total Eggs Today",
      value:     data.eggs?.totalEggsToday ?? 0,
      icon:      Icons.eggs,
      iconBg:    "#fffde7",
      adminOnly: false,
    },
    {
      title:     "Total Expenses",
      value:     data.financials?.totalExpenses ?? 0,
      icon:      Icons.expenses,
      iconBg:    "#fdecea",
      adminOnly: true,
    },
    {
      title:     "Entire Flock Productive Rate",
      value:     data.flock?.productiveRate ?? 0,
      icon:      Icons.productive,
      iconBg:    "#f3e5f5",
      adminOnly: false,
    },
    {
      title:     "Net Profit / Loss",
      value:     data.financials?.netProfitLoss ?? 0,
      icon:      Icons.profit,
      iconBg:    "#ede7f6",
      adminOnly: true,
    },
    {
      title:     "Mortality Rate (%)",
      value:     data.flock?.mortalityRate ?? 0,
      icon:      Icons.mortality,
      iconBg:    "#e8f5e9",
      adminOnly: false,
    },
    {
      title:     "Feed Stock (kg)",
      value:     data.feedStockKg ?? 0,
      icon:      Icons.feed,
      iconBg:    "#fff8e1",
      adminOnly: false,
    },
  ];

  const visibleCards = ALL_CARDS.filter(
    (card) => !card.adminOnly || canSeeFinancials
  );

  // ── Fetch dashboard data ──
  const fetchDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(`${BASE_URL}/dashboard`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (json && json.success) {
        const shaped = shapeData(json.data);
        setData(shaped);
        // Admin/personnel roles get their tasks from the real local To Do
        // store (see the canViewPersonnel effect below) — don't let this
        // API result (currently always empty) clobber it.
        if (!canViewPersonnel) setTasks(shaped.tasks);
      } else {
        setData(EMPTY);
        setError("No dashboard data yet.");
      }
    } catch {
      setData(EMPTY);
      setError("Cannot connect to server. Showing empty dashboard.");
    } finally {
      setLoading(false);
    }
  };

  // Live sync — refetch whenever module data changes (add/edit/archive/restore/
  // delete), on tab focus, or on cross-tab storage changes. No page reload needed.
  useEffect(() => {
    fetchDashboard();
    const refresh = () => fetchDashboard();
    window.addEventListener("pb_data_changed", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("pb_data_changed", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // To Do card — for roles with an admin To Do (canViewPersonnel), read the
  // real pb_admin_todos store directly instead of the (currently empty) API
  // tasks list, and stay in sync with any edits made on the To Do page.
  useEffect(() => {
    if (!canViewPersonnel) return;
    const update = () => setTasks(loadAdminTasks());
    update();
    window.addEventListener("pb_data_changed", update);
    window.addEventListener("storage", update);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener("pb_data_changed", update);
      window.removeEventListener("storage", update);
      window.removeEventListener("focus", update);
    };
  }, [canViewPersonnel]);

  // Alert card — read from the same notification store the Sidebar badge
  // uses, so it's always showing real, current, unread items.
  const [alerts, setAlerts] = useState(loadDashboardAlerts);
  useEffect(() => {
    const update = () => setAlerts(loadDashboardAlerts());
    update();
    return subscribeNotifs(update);
  }, []);

  // ── Toggle task ──
  const toggleTask = async (id) => {
    if (canViewPersonnel) {
      // Admin tasks live in localStorage (pb_admin_todos) — update there and
      // broadcast so the To Do page and this card both stay in sync.
      try {
        const raw = localStorage.getItem(ADMIN_TODO_KEY);
        const list = raw ? JSON.parse(raw) : [];
        const next = list.map((t) =>
          t.id === id ? { ...t, status: t.status === "Completed" ? "Pending" : "Completed" } : t
        );
        localStorage.setItem(ADMIN_TODO_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event("pb_data_changed"));
      } catch { /* ignore */ }
      return;
    }

    const task = tasks.find((t) => t._id === id);
    setTasks((prev) =>
      prev.map((t) => t._id === id ? { ...t, isCompleted: !t.isCompleted } : t)
    );
    try {
      const token = localStorage.getItem("token");
      await fetch(`${BASE_URL}/tasks/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isCompleted: !task?.isCompleted }),
      });
    } catch { /* silent */ }
  };

  // ── Chart range filters: Today / This Week / This Month ──
  const [pieRange, setPieRange] = useState("month");
  const [trendRange, setTrendRange] = useState("week");

  const filterByRange = (trend, range) => {
    const todayISO = new Date().toISOString().slice(0, 10);
    if (range === "today") return trend.filter((t) => t.date === todayISO);
    if (range === "week") {
      const floor = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
      return trend.filter((t) => t.date >= floor);
    }
    return trend.filter((t) => t.date.startsWith(todayISO.slice(0, 7))); // this calendar month
  };

  const allTrend = data.eggs?.dailyTrend ?? [];
  // mockApi's computeDashboard() emits { date, eggs, total } — normalize to
  // `count` here so the chart/table below always has the field they expect,
  // regardless of which key the backend/mock happens to use.
  const dailyTrend = filterByRange(allTrend, trendRange).map((row) => ({
    ...row,
    count: row.count ?? row.total ?? row.eggs ?? 0,
  }));

  // Pie: size distribution computed for the selected range (falls back to the
  // endpoint's month distribution when per-day sizes aren't available)
  const pieSlice = filterByRange(allTrend, pieRange);
  const rangeSizes = {}; let rangeTotal = 0;
  pieSlice.forEach((t) => {
    for (const [k, v] of Object.entries(t.sizes || {})) { rangeSizes[k] = (rangeSizes[k] || 0) + v; rangeTotal += v; }
  });
  const pieData = EGG_LABELS.map((name, i) => ({
    name,
    value: rangeTotal > 0
      ? +(((rangeSizes[EGG_KEYS[i]] || 0) / rangeTotal) * 100).toFixed(1)
      : parseFloat(data.eggs?.sizeDistribution?.[EGG_KEYS[i]] || 0),
  }));

  const hasPieData = pieData.some((d) => d.value > 0);

  return (
    <PageLayout breadcrumbItems={[{ label: "DASHBOARD" }]}>
      <div className="dash-header">
        <div>
          <h2 className="title">
            {isNewUser ? "Welcome," : "Welcome back,"} {user?.name || "User"}!
          </h2>
          <p className="subtitle">
            {isNewUser
              ? "Let's get your farm set up!"
              : "Here's what's happening in your farm today"}
          </p>
        </div>
      </div>

      {/* ── Top row ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ minWidth: "150px" }}>
          {loading && (
            <span style={{
              fontSize: "12px", fontWeight: "600",
              padding: "4px 14px", borderRadius: "20px",
            }}>
              Loading dashboard...
            </span>
          )}
        </div>

        <button onClick={fetchDashboard} style={{
          background: "",
          border: "none", borderRadius: "8px",
          padding: "6px 16px", fontSize: "13px",
          fontWeight: "600", cursor: "pointer",
          transition: "background 0.2s",
        }}>
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          borderRadius: "8px", padding: "10px 16px",
          color: "#c0392b", fontSize: "12px",
        }}>
           {error}
        </div>
      )}

      {/* ── Stat Cards (Farmer = single horizontal row) ── */}
      <div className={`cards ${!canSeeFinancials ? "cards-row" : ""}`}>
        {visibleCards.map((card) => (
          <Card
            key={card.title}
            title={card.title}
            value={card.value}
            icon={card.icon}
            iconBg={card.iconBg}
          />
        ))}
      </div>

      {/* ── Bottom ── */}
      <div className="bottom">
        <div className="charts-col">

          {/* Egg Size Distribution */}
          <div className="chart-card">
            <div className="chart-header">
              <span className="chart-title">Latest Egg Size Distribution</span>
              <select className="chart-filter" value={pieRange} onChange={(e) => setPieRange(e.target.value)}>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
            {!hasPieData ? (
              <p style={{ color: "#aaa", fontSize: "13px", padding: "12px 0" }}>
                No egg data for this period yet.
              </p>
            ) : (
              <div className="pie-wrap">
                <PieChart width={180} height={180}>
                  <Pie data={pieData} cx={85} cy={85}
                    innerRadius={52} outerRadius={85}
                    dataKey="value" startAngle={90} endAngle={-270}>
                    {pieData.map((_, i) => <Cell key={i} fill={EGG_COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}%`} />
                </PieChart>
                <div className="pie-legend">
                  {EGG_LABELS.map((label, i) => (
                    <div className="legend-row" key={label}>
                      <span className="legend-dot" style={{ background: EGG_COLORS[i] }} />
                      <span className="legend-label">{label}</span>
                      <span className="legend-pct">{pieData[i].value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Daily Egg Harvest Trend */}
          <div className="chart-card">
            <div className="chart-header">
              <span className="chart-title">Daily Egg Harvest Trend</span>
              <select className="chart-filter" value={trendRange} onChange={(e) => setTrendRange(e.target.value)}>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
            {dailyTrend.length === 0 ? (
              <p style={{ color: "#aaa", fontSize: "13px", padding: "12px 0" }}>
                No egg harvest data for this period yet.
              </p>
            ) : (
              <div className="line-wrap">
                <ResponsiveContainer width="55%" height={160}>
                  <LineChart data={dailyTrend}
                    margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count"
                      stroke="#4a90d9" strokeWidth={2}
                      dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="trend-table">
                  {dailyTrend.map((row) => (
                    <div className="trend-row" key={row.date}>
                      <span className="trend-date">{row.date}</span>
                      <span className="trend-count">{row.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT */}
        <div className="right-col">
          <div className="todo-card">
            <h3 className="todo-title">To Do</h3>
            <div className="todo-header-row">
              <span /><span>Date</span><span>Task</span>
            </div>
            {tasks.length === 0 ? (
              <p style={{ color: "#aaa", fontSize: "12px", padding: "8px 0" }}>No tasks yet.</p>
            ) : tasks.slice(0, TODO_LIMIT).map((t) => (
              <div className="todo-row" key={t._id}>
                <input type="checkbox" checked={t.isCompleted}
                  onChange={() => toggleTask(t._id)} className="todo-check" />
                <span className="todo-date">
                  {t.date ? new Date(t.date).toLocaleDateString() : ""}
                </span>
                <span className={`todo-task ${t.isCompleted ? "done" : ""}`}>{t.task}</span>
              </div>
            ))}
            {tasks.length > TODO_LIMIT && (
              <button className="dash-see-all" onClick={() => navigate(role === "Farmer" ? "/todo" : "/admin/todo")}>
                See All
              </button>
            )}
          </div>

          <div className="alert-card">
            <h3 className="alert-title">Alert</h3>
            {alerts.length === 0 ? (
              <p style={{ color: "#aaa", fontSize: "13px" }}>No alerts. All good! ✅</p>
            ) : alerts.slice(0, ALERT_LIMIT).map((a, i) => (
              <div className="alert-row" key={i}>
                <span className="alert-icon">{a.type === "danger" ? "🔺" : "🔶"}</span>
                <span className="alert-msg">{a.message}</span>
              </div>
            ))}
            {alerts.length > ALERT_LIMIT && (
              <button className="dash-see-all" onClick={() => navigate("/notifications")}>
                See All
              </button>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default Dashboard;