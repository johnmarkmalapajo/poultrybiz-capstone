import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiCheck } from "react-icons/fi";
import {
  PieChart, Pie, Cell, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from "recharts";
import PageLayout from "../components/PageLayout";
import Card, { Icons } from "../components/Card";
import { useUser } from "../hooks/useUser";
import { getDashboardSummary } from "../api/dashboard";
import {
  refresh as refreshNotifs, getCached as getCachedNotifs,
  subscribe as subscribeNotifs, getLastError as getNotifsError,
} from "../notifStore";
import {
  refreshAllAssignedTasks, refreshAssignedTasks, refreshPersonalTodos,
  getCachedAllAssignedTasks, getCachedAssignedTasks, getCachedPersonalTodos,
  setAssignedTaskDoneById, updatePersonalTodoById,
  getCurrentUser as getTodoUser, subscribe as subscribeTodos,
} from "../todoStore";
import "./Dashboard.css";
import "./ToDo.css";

const EGG_COLORS = ["#f5d76e","#f5a623","#f0a070","#d4a0e0","#a0c4f0","#70b8d4","#a0d4b0"];
const EGG_LABELS = ["Large","Extra Large","Medium","Jumbo","Small","Peewee","Crack"];
const EGG_KEYS   = ["large","extraLarge","medium","jumbo","small","peewee","crack"];

const EMPTY = {
  flock:      { currentFlockSize: 0, productiveRate: 0, mortalityRate: 0, mortalityToday: 0 },
  eggs:       { totalEggsToday: 0, sizeDistribution: {}, dailyTrend: [] },
  financials: { salesRevenue: 0, totalExpenses: 0, netProfitLoss: 0 },
  feed:       { feedStockKg: 0, feedConsumedToday: 0, feedLowStock: false, feedCriticalStock: false },
  health:     { sickChickens: 0, underTreatment: 0, vaccinationDue: 0 },
  equipment:  { operationalEquipment: 0, maintenanceDueEquipment: 0 },
};

function shapeData(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return EMPTY;
  return {
    ...EMPTY,
    ...d,
    flock:      { ...EMPTY.flock,      ...(d.flock      || {}) },
    eggs:       { ...EMPTY.eggs,       ...(d.eggs       || {}) },
    financials: { ...EMPTY.financials, ...(d.financials || {}) },
    feed:       { ...EMPTY.feed,       ...(d.feed       || {}) },
    health:     { ...EMPTY.health,     ...(d.health     || {}) },
    equipment:  { ...EMPTY.equipment,  ...(d.equipment  || {}) },
  };
}

function SkeletonCard() {
  return (
    <div className="dash-card skel-card">
      <div className="skel skel-icon" />
      <div className="dash-card-info">
        <div className="skel skel-value" />
        <div className="skel skel-label" />
      </div>
    </div>
  );
}

function SkeletonPie() {
  return (
    <div className="pie-wrap">
      <div className="skel skel-circle" />
      <div className="pie-legend">
        {[...Array(4)].map((_, i) => (
          <div className="legend-row" key={i}>
            <div className="skel skel-dot" />
            <div className="skel skel-line" style={{ width: "70%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonLine() {
  return <div className="skel skel-chart" />;
}

function SkeletonRows({ count = 3 }) {
  return (
    <div className="skel-rows">
      {[...Array(count)].map((_, i) => (
        <div className="skel skel-line" key={i} style={{ width: `${85 - i * 10}%` }} />
      ))}
    </div>
  );
}

function Dashboard() {
  const [data, setData]       = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);  const [error, setError]     = useState("");

  const [tasks, setTasks]     = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const [alerts, setAlerts]   = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);

  const { user, role, canSeeFinancials, canViewPersonnel } = useUser();
  const navigate = useNavigate();
  const TODO_LIMIT = 5;
  const ALERT_LIMIT = 4;
  const isNewUser = localStorage.getItem("isNewUser") === "true";
  const todoUser = getTodoUser({ id: "me", userId: "me", name: "You" });

  const ALL_CARDS = [
    { title: "Current Flock Size",              value: data.flock?.currentFlockSize ?? 0, icon: Icons.flock,      iconBg: "#fff3e0", ownerOnly: false },
    { title: "Sales Revenue",                   value: data.financials?.salesRevenue ?? 0, icon: Icons.revenue,   iconBg: "#fff8e1", ownerOnly: true },
    { title: "Total Eggs Today",                value: data.eggs?.totalEggsToday ?? 0,     icon: Icons.eggs,      iconBg: "#fffde7", ownerOnly: false },
    { title: "Total Expenses",                  value: data.financials?.totalExpenses ?? 0, icon: Icons.expenses, iconBg: "#fdecea", ownerOnly: true },
    { title: "Entire Flock Productive Rate",    value: data.flock?.productiveRate ?? 0,    icon: Icons.productive, iconBg: "#f3e5f5", ownerOnly: false },
    { title: "Net Profit / Loss",               value: data.financials?.netProfitLoss ?? 0, icon: Icons.profit,   iconBg: "#ede7f6", ownerOnly: true },
    { title: "Mortality Rate (%)",              value: data.flock?.mortalityRate ?? 0,     icon: Icons.mortality,  iconBg: "#e8f5e9", ownerOnly: false },
    { title: "Feed Stock (kg)",                 value: data.feed?.feedStockKg ?? 0,        icon: Icons.feed,       iconBg: "#fff8e1", ownerOnly: false },
  ];
  const visibleCards = ALL_CARDS.filter((card) => !card.ownerOnly || canSeeFinancials);

  const fetchDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const json = await getDashboardSummary();
      setData(shapeData(json?.data ?? json));
    } catch (err) {
      setData(EMPTY);
      setError(err?.message || "Couldn't load dashboard data.");
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  };

  const fetchAlerts = async () => {
    setAlertsLoading(true);
    await refreshNotifs(role);
    setAlertsLoading(false);
  };
  useEffect(() => {
    const update = () => {
      const list = getCachedNotifs(role)
        .filter((n) => !n.read && n.type === "alert")
        .sort((a, b) => new Date(b.dateTime || 0) - new Date(a.dateTime || 0))
        .map((n) => ({ type: n.priority === "critical" ? "danger" : "warning", message: n.title }));
      setAlerts(list);
      if (getNotifsError()) setAlertsLoading(false);
    };
    fetchAlerts().then(update);
    return subscribeNotifs(update);
  }, [role]);

  const fetchTasks = async () => {
    setTasksLoading(true);
    if (canViewPersonnel) {
      await refreshAllAssignedTasks();
    } else {
      await Promise.all([refreshAssignedTasks(todoUser.id), refreshPersonalTodos(todoUser.userId)]);
    }
    setTasksLoading(false);
  };
  useEffect(() => {
    const update = () => {
      if (canViewPersonnel) {
        setTasks(getCachedAllAssignedTasks().filter((t) => !t.archived));
      } else {
        const assigned = getCachedAssignedTasks().map((t) => ({ ...t, source: "assigned" }));
        const personal = getCachedPersonalTodos().map((t) => ({ ...t, source: "personal" }));
        setTasks([...assigned, ...personal].filter((t) => !t.archived));
      }
    };
    fetchTasks().then(update);
    return subscribeTodos(update);
  }, [canViewPersonnel, todoUser.id]);

  useEffect(() => {
    fetchDashboard();
    const refresh = () => fetchDashboard();
    window.addEventListener("pb_data_changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("pb_data_changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const [confirmComplete, setConfirmComplete] = useState(null);

  const doToggle = async (t) => {
    if (canViewPersonnel || t.source === "assigned") {
      const personnelId = t.personnelId || todoUser.id;
      await setAssignedTaskDoneById(personnelId, t._id, t.status !== "Completed");
    } else {
      await updatePersonalTodoById(t._id, { status: t.status === "Completed" ? "Pending" : "Completed" }, todoUser.userId);
    }
  };

  const toggleTask = (t) => {
    if (t.status !== "Completed") {
      setConfirmComplete(t);
    } else {
      doToggle(t);
    }
  };

  const [pieRange, setPieRange] = useState("month");
  const [trendRange, setTrendRange] = useState("week");

  const filterByRange = (trend, range) => {
    const todayISO = new Date().toISOString().slice(0, 10);
    if (range === "today") return trend.filter((t) => t.date === todayISO);
    if (range === "week") {
      const floor = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
      return trend.filter((t) => t.date >= floor);
    }
    return trend.filter((t) => t.date.startsWith(todayISO.slice(0, 7)));  };

  const allTrend = data.eggs?.dailyTrend ?? [];
  const dailyTrend = filterByRange(allTrend, trendRange).map((row) => ({
    ...row,
    count: row.count ?? row.total ?? row.eggs ?? 0,
  }));

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

      {}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ minWidth: "150px" }}>
          {loading && (
            <span style={{
              fontSize: "12px", fontWeight: "600", color: "var(--text-second, #6b6457)",
              background: "var(--gold-light, #fdf3e3)",
              padding: "4px 14px", borderRadius: "20px",
            }}>
              Loading dashboard...
            </span>
          )}
        </div>

        <button onClick={fetchDashboard} style={{
          background: "var(--gold-light, #fdf3e3)", color: "var(--gold-dark, #c8930c)",
          border: "none", borderRadius: "8px",
          padding: "6px 16px", fontSize: "13px",
          fontWeight: "600", cursor: "pointer",
          transition: "background 0.2s",
        }}>
          Refresh
        </button>
      </div>

      {}
      {error && (
        <div style={{
          background: "var(--red-bg, #fdf0f0)", borderRadius: "8px", padding: "10px 16px",
          color: "var(--red, #d94f4f)", fontSize: "12px",
        }}>
          {error}
        </div>
      )}

      {}
      <div className={`cards ${!canSeeFinancials ? "cards-row" : ""}`}>
        {initialLoad
          ? visibleCards.map((card) => <SkeletonCard key={card.title} />)
          : visibleCards.map((card) => (
              <Card
                key={card.title}
                title={card.title}
                value={card.value}
                icon={card.icon}
                iconBg={card.iconBg}
              />
            ))}
      </div>

      {}
      <div className="bottom">
        <div className="charts-col">

          {}
          <div className="chart-card">
            <div className="chart-header">
              <span className="chart-title">Latest Egg Size Distribution</span>
              <select className="chart-filter" value={pieRange} onChange={(e) => setPieRange(e.target.value)}>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
            {initialLoad ? (
              <SkeletonPie />
            ) : !hasPieData ? (
              <p className="chart-empty">
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

          {}
          <div className="chart-card">
            <div className="chart-header">
              <span className="chart-title">Daily Egg Harvest Trend</span>
              <select className="chart-filter" value={trendRange} onChange={(e) => setTrendRange(e.target.value)}>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
            {initialLoad ? (
              <SkeletonLine />
            ) : dailyTrend.length === 0 ? (
              <p className="chart-empty">
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

        {}
        <div className="right-col">
          <div className="todo-card">
            <h3 className="todo-title">To Do</h3>
            <div className="todo-header-row">
              <span /><span>Date</span><span>Task</span>
            </div>
            {tasksLoading ? (
              <SkeletonRows count={3} />
            ) : tasks.length === 0 ? (
              <p className="card-empty">No tasks yet.</p>
            ) : tasks.slice(0, TODO_LIMIT).map((t) => {
              const done = t.status === "Completed";
              return (
                <div className="todo-row" key={t._id}>
                  <span
                    className={`todo-check ${done ? "checked" : ""}`}
                    onClick={() => toggleTask(t)}
                    title={done ? "Mark as pending" : "Mark as done"}
                  >
                    {done && <FiCheck />}
                  </span>
                  <span className="todo-date">
                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : ""}
                  </span>
                  <span className={`todo-task ${done ? "done" : ""}`}>{t.title}</span>
                </div>
              );
            })}
            {tasks.length > TODO_LIMIT && (
              <button className="dash-see-all" onClick={() => navigate(role === "Farmer" ? "/todo" : "/owner/todo")}>
                See All
              </button>
            )}
          </div>

          <div className="alert-card">
            <h3 className="alert-title">Alert</h3>
            {alertsLoading ? (
              <SkeletonRows count={2} />
            ) : alerts.length === 0 ? (
              <p className="alert-empty">No alerts. All good! ✅</p>
            ) : alerts.slice(0, ALERT_LIMIT).map((a, i) => (
              <div className="alert-row" key={i}>
                <span className={`alert-icon ${a.type}`}>{a.type === "danger" ? "🔺" : "🔶"}</span>
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

      {confirmComplete && (
        <div className="todo-confirm-overlay" onClick={() => setConfirmComplete(null)}>
          <div className="todo-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="todo-confirm-title">Mark this task as completed?</h3>
            <p className="todo-confirm-message">The task status will be changed to Completed.</p>
            <div className="todo-confirm-actions">
              <button className="todo-confirm-cancel" onClick={() => setConfirmComplete(null)}>Cancel</button>
              <button className="todo-btn-save" onClick={() => { doToggle(confirmComplete); setConfirmComplete(null); }}>Mark as Completed</button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

export default Dashboard;