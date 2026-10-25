import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiCheck, FiChevronLeft, FiChevronRight, FiFilter } from "react-icons/fi";
import {
  PieChart, Pie, Cell, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from "recharts";
import PageLayout from "../components/PageLayout";
import Card, { Icons } from "../components/Card";
import { useUser } from "../hooks/useUser";
import { getDashboardSummary } from "../api/dashboard";
import { listHealthRecords } from "../api/healthRecord";
import { listEggRecords } from "../api/eggRecord";
import { listFlocks } from "../api/flockProfile";
import {
  refresh as refreshNotifs, getCached as getCachedNotifs,
  subscribe as subscribeNotifs, getLastError as getNotifsError,
} from "../notifStore";
import {
  refreshPersonalTodos, getCachedPersonalTodos, updatePersonalTodoById,
  getCurrentUser as getTodoUser, subscribe as subscribeTodos,
} from "../todoStore";
import "./EggRecord.css";
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

const CHART_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CHART_SIZE_KEYS = ["peewee", "small", "medium", "large", "extraLarge", "jumbo"];
const CHART_FILTER_DEFAULTS = { period: "all", year: "All", month: "All", week: "", dateFrom: "", dateTo: "", batchId: "All" };

const chartToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const chartIsoWeek = (dateStr) => {
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNum = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNum + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${target.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
};

const chartMatchesPeriod = (date, f) => {
  const d = new Date(date);
  const recYear = isNaN(d) ? null : String(d.getFullYear());
  const recMonth = isNaN(d) ? null : CHART_MONTHS[d.getMonth()];
  if (f.period === "all") return true;
  if (f.period === "today") return date === chartToday();
  if (f.period === "week") return !!f.week && chartIsoWeek(date) === f.week;
  if (f.period === "month") return f.year !== "All" && f.month !== "All" && recYear === f.year && recMonth === f.month;
  if (f.period === "year") return f.year !== "All" && recYear === f.year;
  if (f.period === "custom") return (!f.dateFrom || date >= f.dateFrom) && (!f.dateTo || date <= f.dateTo);
  return true;
};

const chartMatchesFilters = (record, f) =>
  (f.batchId === "All" || record.batchId === f.batchId) && chartMatchesPeriod(record.date, f);

const chartPeriodLabel = (f) => {
  let period = "All Records";
  if (f.period === "today") period = "Today";
  else if (f.period === "week" && f.week) period = f.week;
  else if (f.period === "month" && f.month !== "All" && f.year !== "All") period = `${f.month} ${f.year}`;
  else if (f.period === "year" && f.year !== "All") period = f.year;
  else if (f.period === "custom" && (f.dateFrom || f.dateTo)) period = `${f.dateFrom || "—"} – ${f.dateTo || "—"}`;
  return `${period} · ${f.batchId === "All" ? "All Batches" : `Batch ${f.batchId}`}`;
};

function ChartFilter({ filters, onApply, dates, batches }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [error, setError] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const uniq = (vals) => [...new Set(vals.filter(Boolean))];
  const yearOptions = uniq(
    dates.map((date) => { const d = new Date(date); return isNaN(d) ? null : String(d.getFullYear()); })
  ).sort((a, b) => b - a);
  const monthOptions = uniq(
    dates
      .filter((date) => draft.year === "All" || String(new Date(date).getFullYear()) === draft.year)
      .map((date) => { const d = new Date(date); return isNaN(d) ? null : CHART_MONTHS[d.getMonth()]; })
  ).sort((a, b) => CHART_MONTHS.indexOf(a) - CHART_MONTHS.indexOf(b));

  const handleChange = (key, value) => setDraft((f) => ({ ...f, [key]: value }));
  const openPanel = () => { setDraft(filters); setError(""); setOpen((s) => !s); };
  const clearFilters = () => { setDraft(CHART_FILTER_DEFAULTS); setError(""); onApply(CHART_FILTER_DEFAULTS); };
  const applyFilters = () => {
    if (draft.period === "custom") {
      const today = chartToday();
      if (draft.dateFrom && draft.dateFrom > today) { setError("Start date cannot be a future date."); return; }
      if (draft.dateTo && draft.dateTo > today) { setError("End date cannot be a future date."); return; }
      if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) { setError("Start date cannot be later than end date."); return; }
    }
    setError("");
    onApply(draft);
    setOpen(false);
  };

  const activeFilterCount =
    (filters.period !== "all" ? 1 : 0) +
    (filters.batchId !== "All" ? 1 : 0);

  return (
    <div className="egg-filter-wrap chart-filter-wrap" ref={wrapRef}>
      <button type="button" className="egg-toolbar-btn" onClick={openPanel}>
        <FiFilter /> Filter
        {activeFilterCount > 0 && <span className="egg-filter-count">{activeFilterCount}</span>}
      </button>

      {open && (
        <div className="egg-filter-dropdown">
          <div className="egg-filter-dropdown-header">
            <span>Filter Records</span>
          </div>

          <div className="egg-filter-section-label">Date Filter</div>
          <div className="egg-filter-row">
            <div className="egg-filter-group">
              <label className="egg-filter-label">Date Period</label>
              <select
                className="egg-filter-select"
                value={draft.period}
                onChange={(e) => handleChange("period", e.target.value)}
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
              <div className="egg-filter-group">
                <label className="egg-filter-label">Week</label>
                <input
                  type="week"
                  className="egg-filter-select"
                  value={draft.week}
                  onChange={(e) => handleChange("week", e.target.value)}
                />
              </div>
            )}

            {draft.period === "month" && (
              <div className="egg-filter-group">
                <label className="egg-filter-label">Month</label>
                <select
                  className="egg-filter-select"
                  value={draft.month}
                  onChange={(e) => handleChange("month", e.target.value)}
                >
                  <option value="All">Select Month</option>
                  {monthOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            )}

            {(draft.period === "month" || draft.period === "year") && (
              <div className="egg-filter-group">
                <label className="egg-filter-label">Year</label>
                <select
                  className="egg-filter-select"
                  value={draft.year}
                  onChange={(e) => handleChange("year", e.target.value)}
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
            <div className="egg-filter-group">
              <label className="egg-filter-label">Start Date / End Date</label>
              <div className="egg-filter-date-range">
                <input type="date" className="egg-filter-select" value={draft.dateFrom}
                  max={draft.dateTo || chartToday()}
                  onChange={(e) => handleChange("dateFrom", e.target.value)} aria-label="From date" />
                <span>to</span>
                <input type="date" className="egg-filter-select" value={draft.dateTo}
                  min={draft.dateFrom || undefined} max={chartToday()}
                  onChange={(e) => handleChange("dateTo", e.target.value)} aria-label="To date" />
              </div>
            </div>
          )}

          <div className="egg-filter-section-label">Filters</div>
          <div className="egg-filter-row">
            <div className="egg-filter-group">
              <label className="egg-filter-label">Batch ID</label>
              <select
                className="egg-filter-select"
                value={draft.batchId}
                onChange={(e) => handleChange("batchId", e.target.value)}
              >
                <option value="All">All Batches</option>
                {batches.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="chart-filter-error">{error}</p>}

          <div className="egg-filter-actions">
            <button type="button" className="egg-filter-clear" onClick={clearFilters}>Clear All</button>
            <button type="button" className="egg-filter-apply" onClick={applyFilters}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

const CAL_WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const calDayKey = (value) => {
  if (!value) return "";
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

const calLocalKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function buildScheduleIndex(records) {
  const index = {};
  records.forEach((r) => {
    if (r.archived) return;
    const isDiagnosis = r.recordType === "Diagnosis";
    const own = Array.isArray(r.schedules) ? r.schedules : [];
    const source = own.length ? own : !isDiagnosis && r.nextSchedule ? [r.nextSchedule] : [];
    [...new Set(source.map(calDayKey).filter(Boolean))].forEach((day) => {
      (index[day] = index[day] || []).push({
        key: `${r._id}-${day}`,
        id: r._id,
        kind: isDiagnosis ? "diagnosis" : "treatment",
        title: isDiagnosis
          ? `Diagnosis ${r.diagnosisCode || ""}`.trim()
          : `${r.recordType}${r.vaccineOrDrug ? `: ${r.vaccineOrDrug}` : ""}`,
        detail: isDiagnosis
          ? [r.batchId && `Batch ${r.batchId}`, r.vetDiagnosis || r.presumptiveDiagnosis].filter(Boolean).join(" · ")
          : [r.batchId && `Batch ${r.batchId}`, r.medicationCode].filter(Boolean).join(" · "),
      });
    });
  });
  return index;
}

function FarmScheduleCalendar() {
  const navigate = useNavigate();
  const todayKey = calLocalKey(new Date());
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState(todayKey);
  const [index, setIndex] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = () =>
      listHealthRecords()
        .then((json) => {
          if (!active) return;
          const list = Array.isArray(json) ? json : json?.records || json?.data || [];
          setIndex(buildScheduleIndex(list));
          setError("");
        })
        .catch((err) => {
          if (active) setError(err?.message || "Couldn't load farm schedules.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    load();
    window.addEventListener("pb_data_changed", load);
    return () => {
      active = false;
      window.removeEventListener("pb_data_changed", load);
    };
  }, []);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const leading = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [
    ...Array(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => calLocalKey(new Date(year, monthIndex, i + 1))),
  ];

  const changeMonth = (step) => setMonth(new Date(year, monthIndex + step, 1));
  const selectedItems = index[selected] || [];
  const selectedLabel = new Date(`${selected}T00:00:00`).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  const openRecord = (item) =>
    navigate(`/records/health?tab=${item.kind === "diagnosis" ? "diagnosis" : "vaccination"}&view=${item.id}`);

  return (
    <div className="cal-card">
      <div className="cal-head">
        <h3 className="cal-title">Calendar</h3>
        <div className="cal-nav">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month"><FiChevronLeft /></button>
          <span>{month.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
          <button type="button" onClick={() => changeMonth(1)} aria-label="Next month"><FiChevronRight /></button>
        </div>
      </div>

      {error && <p className="card-empty">{error}</p>}

      <div className="cal-grid">
        {CAL_WEEKDAYS.map((d, i) => <span className="cal-weekday" key={`${d}-${i}`}>{d}</span>)}
        {cells.map((day, i) => {
          if (!day) return <span key={`blank-${i}`} />;
          const items = index[day] || [];
          const kinds = [...new Set(items.map((item) => item.kind))];
          return (
            <button
              type="button"
              key={day}
              className={`cal-day${day === todayKey ? " today" : ""}${day === selected ? " selected" : ""}`}
              onClick={() => setSelected(day)}
              aria-label={`${day}${items.length ? `, ${items.length} schedule${items.length > 1 ? "s" : ""}` : ""}`}
            >
              <span className="cal-num">{Number(day.slice(8))}</span>
              {kinds.length > 0 && (
                <span className="cal-dots">
                  {kinds.map((kind) => <i key={kind} className={`cal-dot ${kind}`} />)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="cal-legend">
        <span><i className="cal-dot diagnosis" /> Diagnosis</span>
        <span><i className="cal-dot treatment" /> Medication/Vaccination</span>
      </div>

      <div className="cal-day-list">
        <p className="cal-day-label">{selectedLabel}</p>
        {loading ? (
          <SkeletonRows count={2} />
        ) : selectedItems.length === 0 ? (
          <p className="card-empty">No schedules on this date.</p>
        ) : selectedItems.map((item) => (
          <button type="button" className={`cal-item ${item.kind}`} key={item.key} onClick={() => openRecord(item)}>
            <span className="cal-item-text">
              <strong>{item.title}</strong>
              {item.detail && <small>{item.detail}</small>}
            </span>
          </button>
        ))}
      </div>
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

  const { user, role, canSeeFinancials } = useUser();
  const navigate = useNavigate();
  const TODO_LIMIT = 3;
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
      const seen = new Set();
      const list = getCachedNotifs(role)
        .filter((n) => !n.read && n.type === "alert" && n.priority === "critical")
        .sort((a, b) => new Date(b.dateTime || 0) - new Date(a.dateTime || 0))
        .filter((n) => {
          const key = `${n.title}|${n.description || ""}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((n) => ({ id: n.id, type: "danger", message: n.title }));
      setAlerts(list);
      if (getNotifsError()) setAlertsLoading(false);
    };
    fetchAlerts().then(update);
    return subscribeNotifs(update);
  }, [role]);

  const fetchTasks = async () => {
    setTasksLoading(true);
    await refreshPersonalTodos(todoUser.userId);
    setTasksLoading(false);
  };
  useEffect(() => {
    const update = () => {
      setTasks(getCachedPersonalTodos().filter((t) => !t.archived));
    };
    fetchTasks().then(update);
    return subscribeTodos(update);
  }, [todoUser.userId]);

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
    await updatePersonalTodoById(t._id, { status: t.status === "Completed" ? "Pending" : "Completed" }, todoUser.userId);
  };

  const toggleTask = (t) => {
    if (t.status !== "Completed") {
      setConfirmComplete(t);
    } else {
      doToggle(t);
    }
  };

  const [pieFilters, setPieFilters] = useState(() => {
    const now = new Date();
    return { ...CHART_FILTER_DEFAULTS, period: "month", year: String(now.getFullYear()), month: CHART_MONTHS[now.getMonth()] };
  });
  const [trendFilters, setTrendFilters] = useState(() => ({
    ...CHART_FILTER_DEFAULTS, period: "week", week: chartIsoWeek(chartToday()),
  }));

  const [eggRecords, setEggRecords] = useState([]);
  const [eggLoading, setEggLoading] = useState(true);
  const [eggError, setEggError] = useState("");

  useEffect(() => {
    let active = true;
    const load = () =>
      listEggRecords()
        .then((json) => {
          if (!active) return;
          const list = json?.records || (Array.isArray(json) ? json : []);
          setEggRecords(
            list
              .filter((r) => !r.isArchived && r.collectionDate)
              .map((r) => ({ ...r, date: String(r.collectionDate).slice(0, 10) }))
          );
          setEggError("");
        })
        .catch((err) => {
          if (active) setEggError(err?.message || "Couldn't load egg records.");
        })
        .finally(() => {
          if (active) setEggLoading(false);
        });
    load();
    window.addEventListener("pb_data_changed", load);
    return () => {
      active = false;
      window.removeEventListener("pb_data_changed", load);
    };
  }, []);

  const [batchOptions, setBatchOptions] = useState([]);

  useEffect(() => {
    let active = true;
    listFlocks()
      .then((json) => {
        if (!active) return;
        const list = Array.isArray(json) ? json : json?.records || json?.flocks || json?.data || [];
        setBatchOptions(
          [...new Set(list.filter((f) => !f.isArchived).map((f) => f.batchId).filter(Boolean))]
            .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
        );
      })
      .catch(() => {
        if (active) setBatchOptions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const eggDates = eggRecords.map((r) => r.date);

  const dailyTrend = Object.values(
    eggRecords
      .filter((r) => chartMatchesFilters(r, trendFilters))
      .reduce((acc, r) => {
        const row = acc[r.date] || (acc[r.date] = { date: r.date, count: 0 });
        row.count += Number(r.totalEggs) || 0;
        return acc;
      }, {})
  ).sort((a, b) => a.date.localeCompare(b.date));

  const rangeSizes = {}; let rangeTotal = 0;
  eggRecords
    .filter((r) => chartMatchesFilters(r, pieFilters))
    .forEach((r) => {
      CHART_SIZE_KEYS.forEach((k) => {
        const v = Number(r[k]) || 0;
        rangeSizes[k] = (rangeSizes[k] || 0) + v;
        rangeTotal += v;
      });
    });
  const pieData = EGG_LABELS.map((name, i) => ({
    name,
    value: rangeTotal > 0 ? +(((rangeSizes[EGG_KEYS[i]] || 0) / rangeTotal) * 100).toFixed(1) : 0,
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
              <div className="chart-heading">
                <span className="chart-title">Latest Egg Size Distribution</span>
                <span className="chart-period">{chartPeriodLabel(pieFilters)}</span>
              </div>
              <ChartFilter filters={pieFilters} onApply={setPieFilters} dates={eggDates} batches={batchOptions} />
            </div>
            {eggError && <p className="chart-filter-error">{eggError}</p>}
            {eggLoading ? (
              <SkeletonPie />
            ) : !hasPieData ? (
              <p className="chart-empty">
                No egg data for this period yet.
              </p>
            ) : (
              <div className="pie-wrap">
                <div className="pie-chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%"
                        innerRadius="61%" outerRadius="98%"
                        dataKey="value" startAngle={90} endAngle={-270}>
                        {pieData.map((_, i) => <Cell key={i} fill={EGG_COLORS[i]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
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
              <div className="chart-heading">
                <span className="chart-title">Daily Egg Harvest Trend</span>
                <span className="chart-period">{chartPeriodLabel(trendFilters)}</span>
              </div>
              <ChartFilter filters={trendFilters} onApply={setTrendFilters} dates={eggDates} batches={batchOptions} />
            </div>
            {eggError && <p className="chart-filter-error">{eggError}</p>}
            {eggLoading ? (
              <SkeletonLine />
            ) : dailyTrend.length === 0 ? (
              <p className="chart-empty">
                No egg harvest data for this period yet.
              </p>
            ) : (
              <div className="line-wrap">
                <div className="line-chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyTrend}
                    margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickMargin={4} interval="preserveStartEnd" minTickGap={8} />
                    <YAxis tick={{ fontSize: 10 }} width={44} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count"
                      stroke="#4a90d9" strokeWidth={2}
                      dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
                </div>
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
          <FarmScheduleCalendar />

          <div className="todo-card">
            <h3 className="todo-title">To Do</h3>
            <div className="todo-header-row">
              <span /><span>Date</span><span>Task</span>
            </div>
            {tasksLoading ? (
              <SkeletonRows count={3} />
            ) : tasks.length === 0 ? (
              <p className="card-empty">No personal tasks yet.</p>
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
                See More
              </button>
            )}
          </div>

          <div className="alert-card">
            <h3 className="alert-title">Alert</h3>
            {alertsLoading ? (
              <SkeletonRows count={2} />
            ) : alerts.length === 0 ? (
              <p className="alert-empty">No critical alerts at this time.</p>
            ) : alerts.slice(0, ALERT_LIMIT).map((a) => (
              <div className="alert-row" key={a.id}>
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