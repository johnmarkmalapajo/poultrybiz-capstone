import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus,
  FiSearch,
  FiFilter,
  FiEdit2,
  FiArchive,
  FiMaximize,
  FiLayers,
  FiCheckCircle,
  FiAlertTriangle,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { useUser } from "../hooks/useUser";
import ExportMenu from "../components/ExportMenu";
import { getFarmInfo } from "../api/profile";
import "./EggRecord.css";
import { useArchiveConfirm } from "../hooks/useArchiveConfirm";
import ArchiveConfirmModal from "../components/ArchiveConfirmModal";
import { listEggRecords } from "../api/eggRecord";
import { listFlocks } from "../api/flockProfile";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination from "../components/TablePagination";
import "../components/TablePagination.css";

export default function EggRecord() {
  const navigate = useNavigate();
  const { canEdit, canArchive } = useUser();
  const { pending: archivePending, requestArchive, cancelArchive, confirmArchive } = useArchiveConfirm();

  const [eggRecords, setEggRecords] = useState([]);

  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const defaultFilters = { reportScope: "byBatch", batchId: "All", breed: "All", period: "all", year: "All", month: "All", week: "", dateFrom: "", dateTo: "" };
  const [filters, setFilters] = useState(defaultFilters);
  const [draft, setDraft] = useState(defaultFilters);
  const [filterApplied, setFilterApplied] = useState(false);
  const filterRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewRecord, setViewRecord] = useState(null);
  const renderRemarksCell = (record, text) => {
    if (!text) return "";
    if (text.length <= 15) return text;
    return (
      <button type="button" className="egg-view-remarks-link" onClick={() => setViewRecord(record)}>
        View Remarks
      </button>
    );
  };
  const [farmInfo, setFarmInfo] = useState({ farmName: "", farmLocation: "", farmContact: "", farmEmail: "" });
  const [flocks, setFlocks] = useState([]);

  useEffect(() => {
    fetchEggRecords();
    getFarmInfo().then((d) => setFarmInfo(d)).catch(() => {});
    listFlocks().then((data) => setFlocks(Array.isArray(data) ? data : data.records || data.flocks || [])).catch(() => setFlocks([]));
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const fetchEggRecords = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listEggRecords();
      const records = (data.records || (Array.isArray(data) ? data : []) || []).map((r) => ({
        ...r,
        date: r.collectionDate ? String(r.collectionDate).slice(0, 10) : r.date,
      }));
      setEggRecords(records);
    } catch (err) {
      setEggRecords([]);
      setError(err?.message || "Couldn't load egg records.");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => setDraft((f) => ({ ...f, [key]: value }));
  const clearFilters = () => { setDraft(defaultFilters); setFilters(defaultFilters); setFilterApplied(false); };
  const changeReportScope = (scope) => setDraft((f) => ({ ...f, reportScope: scope, batchId: "All", breed: "All" }));
  const applyFilters = () => {
    if (draft.period === "custom") {
      const today = todayStr();
      if (draft.dateFrom && draft.dateFrom > today) {
        setError("Start date cannot be a future date.");
        return;
      }
      if (draft.dateTo && draft.dateTo > today) {
        setError("End date cannot be a future date.");
        return;
      }
      if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) {
        setError("Start date cannot be later than end date.");
        return;
      }
    }
    setError("");
    setFilters(draft);
    setFilterApplied(true);
    setShowFilter(false);
  };
  const openFilterPanel = () => { setDraft(filters); setShowFilter((s) => !s); };
  const activeFilterCount =
    (filterApplied && filters.period !== "all" ? 1 : 0) +
    (filterApplied && filters.reportScope === "byBatch" && filters.batchId !== "All" ? 1 : 0) +
    (filterApplied && filters.reportScope === "byBreed" && filters.breed !== "All" ? 1 : 0);

  const uniq = (vals) => [...new Set(vals.filter(Boolean))];
  const batchOptions = uniq(flocks.map((f) => f.batchId));
  const breedOptions = uniq(flocks.map((f) => f.breed));
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const yearOptions = uniq(
    eggRecords.map((r) => { const d = new Date(r.date); return isNaN(d) ? null : String(d.getFullYear()); })
  ).sort((a, b) => b - a);
  const monthOptions = uniq(
    eggRecords
      .filter((r) => draft.year === "All" || String(new Date(r.date).getFullYear()) === draft.year)
      .map((r) => { const d = new Date(r.date); return isNaN(d) ? null : MONTH_NAMES[d.getMonth()]; })
  ).sort((a, b) => MONTH_NAMES.indexOf(a) - MONTH_NAMES.indexOf(b));

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

  const matchScope = (record, f) =>
    f.reportScope === "byBatch" ? (f.batchId === "All" || record.batchId === f.batchId) :
    f.reportScope === "byBreed" ? (f.breed === "All" || record.flock?.breed === f.breed) :
    true;

  const matchPeriodOnly = (record, f) => {
    const d = new Date(record.date);
    const recYear = isNaN(d) ? null : String(d.getFullYear());
    const recMonth = isNaN(d) ? null : MONTH_NAMES[d.getMonth()];
    return (
      f.period === "all" ? true :
      f.period === "today" ? record.date === todayStr() :
      f.period === "week" ? (!!f.week && isoWeekOf(record.date) === f.week) :
      f.period === "month" ? (f.year !== "All" && f.month !== "All" && recYear === f.year && recMonth === f.month) :
      f.period === "year" ? (f.year !== "All" && recYear === f.year) :
      f.period === "custom" ? ((!f.dateFrom || record.date >= f.dateFrom) && (!f.dateTo || record.date <= f.dateTo)) :
      true
    );
  };

  const matchesPeriod = (record, f) => matchScope(record, f) && matchPeriodOnly(record, f);

  const searchMatch = (record) => record.batchId?.toLowerCase().includes(search.toLowerCase());

  const tableRecords = eggRecords.filter((record) =>
    searchMatch(record) && (!filterApplied || matchesPeriod(record, filters))
  );

  const statsRecords = (filterApplied && filters.period !== "all")
    ? tableRecords
    : eggRecords.filter((record) =>
        searchMatch(record) && record.date === todayStr() && (!filterApplied || matchScope(record, filters))
      );

  const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
  const sortAccessor = (row, col) => {
    if (col === "date") return row.collectionDate || row.date || "";
    if (col === "batchId") return row.batchId || "";
    if (col === "peewee") return Number(row.peewee) || 0;
    if (col === "small") return Number(row.small) || 0;
    if (col === "medium") return Number(row.medium) || 0;
    if (col === "large") return Number(row.large) || 0;
    if (col === "extraLarge") return Number(row.extraLarge) || 0;
    if (col === "jumbo") return Number(row.jumbo) || 0;
    if (col === "crackedEggs") return Number(row.crackedEggs) || 0;
    if (col === "goodEggs") return Number(row.goodEggs) || 0;
    if (col === "totalEggs") return Number(row.totalEggs) || 0;
    if (col === "henDayPercent") return Number(row.henDayPercent) || 0;
    return "";
  };
  const sortedRecords = sortData(tableRecords, sortAccessor);
  const pager = usePagination(sortedRecords.length);
  useEffect(() => { pager.setPage(1); }, [search, filters]);
  const pageRecords = sortedRecords.slice(pager.startIndex, pager.endIndex);

  const exportMeta = (() => {
    const breeds = uniq(tableRecords.map((r) => r.flock?.breed).filter(Boolean));
    const breedLabel = breeds.length === 0 ? "—" : breeds.length === 1 ? breeds[0] : "Various";

    const batchLabel = filters.batchId !== "All" ? filters.batchId : (batchOptions.length === 1 ? batchOptions[0] : "Various");

    const latestByBatch = {};
    tableRecords.forEach((r) => {
      const bid = r.batchId;
      if (!bid) return;
      if (!latestByBatch[bid] || r.date > latestByBatch[bid].date) {
        latestByBatch[bid] = r;
      }
    });
    const batchHenCounts = Object.values(latestByBatch).map((r) => r.birdsAtCollection ?? 0);
    const sizeLabel = batchHenCounts.length === 0 ? "—" : batchHenCounts.reduce((a, b) => a + b, 0).toLocaleString();

    const acqDates = uniq(tableRecords.map((r) => r.flock?.dateAcquired).filter(Boolean));
    const acqLabel = acqDates.length === 1 ? new Date(acqDates[0]).toLocaleDateString() : "—";

    const dates = tableRecords.map((r) => new Date(r.date)).filter((d) => !isNaN(d));
    let monthLabel = "All Records";
    if (!filterApplied || filters.period === "all") {
      monthLabel = "All Records";
    } else if (filters.period === "today") {
      monthLabel = "Today";
    } else if (filters.period === "week" && filters.week) {
      monthLabel = filters.week;
    } else if (filters.period === "month" && filters.month !== "All" && filters.year !== "All") {
      monthLabel = `${filters.month} ${filters.year}`;
    } else if (filters.period === "year" && filters.year !== "All") {
      monthLabel = filters.year === String(new Date().getFullYear()) ? "This Year" : `Year ${filters.year}`;
    } else if (filters.period === "custom" && (filters.dateFrom || filters.dateTo)) {
      monthLabel = `${filters.dateFrom || "—"} – ${filters.dateTo || "—"}`;
    } else if (dates.length > 0) {
      const min = new Date(Math.min(...dates));
      const max = new Date(Math.max(...dates));
      const fmt = (d) => d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      monthLabel = fmt(min) === fmt(max) ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
    }

    return {
      farmName: farmInfo.farmName,
      location: farmInfo.farmLocation,
      contact: farmInfo.farmContact,
      email: farmInfo.farmEmail,
      logoUrl: farmInfo.farmLogo
        ? (farmInfo.farmLogo.startsWith("http") ? farmInfo.farmLogo : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${farmInfo.farmLogo}`)
        : "",
      period: monthLabel,
      fields:
        filters.reportScope === "byBatch"
          ? filters.batchId === "All"
            ? [
                { label: "Batch", value: "All Batches" },
                { label: "Current Flock Size", value: sizeLabel },
              ]
            : [
                { label: "Batch ID", value: batchLabel },
                { label: "Breed of Layers", value: breedLabel },
                { label: "Current Flock Size", value: sizeLabel },
                ...(acqDates.length === 1 ? [{ label: "Acquisition Date", value: acqLabel }] : []),
              ]
          : filters.reportScope === "byBreed"
          ? [
              { label: "Breed of Layers", value: filters.breed !== "All" ? filters.breed : breedLabel },
              { label: "Number of Hens", value: sizeLabel },
            ]
          : [],    };
  })();

  const statCardPeriodLabel = (filterApplied && filters.period !== "all") ? exportMeta.period : "Today";

  const liveStats = (() => {
    const totalEggs = statsRecords.reduce((s, r) => s + (r.totalEggs || 0), 0);
    const marketableEggs = statsRecords.reduce((s, r) => s + (r.goodEggs || 0), 0);
    const crackedEggs = statsRecords.reduce((s, r) => s + (r.crackedEggs || 0), 0);
    return { totalEggs, marketableEggs, crackedEggs };
  })();

  const tableStats = (() => {
    const totalEggs = tableRecords.reduce((s, r) => s + (r.totalEggs || 0), 0);
    const marketableEggs = tableRecords.reduce((s, r) => s + (r.goodEggs || 0), 0);
    const crackedEggs = tableRecords.reduce((s, r) => s + (r.crackedEggs || 0), 0);
    return { totalEggs, marketableEggs, crackedEggs };
  })();

  const exportSummary = tableRecords.length
    ? [
        { label: "Good Eggs", value: tableStats.marketableEggs.toLocaleString() },
        { label: "Bad Eggs", value: tableStats.crackedEggs.toLocaleString() },
        { label: "Total Eggs", value: tableStats.totalEggs.toLocaleString() },
      ]
    : [];

  const showBatchColumn = filters.reportScope === "byBatch" && filters.batchId === "All";
  const showBreedColumn = filters.reportScope === "byBatch" && filters.batchId === "All";
  const isMonthMode = filterApplied && filters.period === "month" && filters.month !== "All" && filters.year !== "All";

  const eggReportColumns = [
    { key: "date", label: isMonthMode ? "Day" : "Date" },
    ...(showBatchColumn ? [{ key: "batchId", label: "Batch ID" }] : []),
    ...(showBreedColumn ? [{ key: "breed", label: "Breed" }] : []),
    { key: "hens", label: "Number of Hens" },
    { key: "peewee", label: "Peewee" },
    { key: "small", label: "Small" },
    { key: "medium", label: "Medium" },
    { key: "large", label: "Large" },
    { key: "extraLarge", label: "Extra Large" },
    { key: "jumbo", label: "Jumbo" },
    { key: "badEggs", label: "Cracked Eggs" },
    { key: "goodEggs", label: "Good Eggs" },
    { key: "totalEggsCol", label: "Total Eggs" },
    { key: "productionRate", label: "Production Rate (%)" },
  ];

  const buildRow = (r, dayLabel) => {
    const hens = r.birdsAtCollection ?? 0;
    const good = r.goodEggs || 0;
    const bad = r.crackedEggs || 0;
    const rate = r.henDayPercent ?? 0;
    return {
      date: dayLabel || (r.date ? new Date(r.date).toLocaleDateString("en-CA") : "—"),
      batchId: r.batchId || "—",
      breed: r.flock?.breed || "—",
      hens,
      jumbo: r.jumbo || 0,
      extraLarge: r.extraLarge || 0,
      large: r.large || 0,
      medium: r.medium || 0,
      small: r.small || 0,
      peewee: r.peewee || 0,
      goodEggs: good,
      badEggs: bad,
      totalEggsCol: good + bad,
      productionRate: `${rate}%`,
    };
  };

  const consolidateDayRecords = (records, dayLabel) => {
    const hens = records.reduce((s, r) => s + (r.birdsAtCollection ?? 0), 0);
    const jumbo = records.reduce((s, r) => s + (r.jumbo || 0), 0);
    const extraLarge = records.reduce((s, r) => s + (r.extraLarge || 0), 0);
    const large = records.reduce((s, r) => s + (r.large || 0), 0);
    const medium = records.reduce((s, r) => s + (r.medium || 0), 0);
    const small = records.reduce((s, r) => s + (r.small || 0), 0);
    const peewee = records.reduce((s, r) => s + (r.peewee || 0), 0);
    const goodEggs = records.reduce((s, r) => s + (r.goodEggs || 0), 0);
    const badEggs = records.reduce((s, r) => s + (r.crackedEggs || 0), 0);
    const totalEggs = goodEggs + badEggs;
    const rate = hens > 0 ? Number(((totalEggs / hens) * 100).toFixed(2)) : 0;
    return {
      date: dayLabel,
      batchId: "—",
      breed: filters.reportScope === "byBreed" && filters.breed !== "All" ? filters.breed : "—",
      hens,
      jumbo,
      extraLarge,
      large,
      medium,
      small,
      peewee,
      goodEggs,
      badEggs,
      totalEggsCol: totalEggs,
      productionRate: `${rate}%`,
    };
  };

  const emptyDayRow = (dayLabel) => ({
    date: dayLabel,
    batchId: "—",
    breed: "—",
    hens: 0,
    jumbo: 0,
    extraLarge: 0,
    large: 0,
    medium: 0,
    small: 0,
    peewee: 0,
    goodEggs: 0,
    badEggs: 0,
    totalEggsCol: 0,
    productionRate: "0%",
  });

  const eggReportRows = (() => {
    if (isMonthMode) {
      const monthIndex = MONTH_NAMES.indexOf(filters.month);
      const year = Number(filters.year);
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      const byDate = {};
      tableRecords.forEach((r) => {
        if (!byDate[r.date]) byDate[r.date] = [];
        byDate[r.date].push(r);
      });
      const rows = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const dayLabel = `Day ${day}`;
        const dayRecords = byDate[dateStr];
        if (dayRecords && dayRecords.length) {
          if (filters.reportScope !== "byBatch") {
            rows.push(consolidateDayRecords(dayRecords, dayLabel));
          } else {
            dayRecords.forEach((r) => rows.push(buildRow(r, dayLabel)));
          }
        } else {
          rows.push(emptyDayRow(dayLabel));
        }
      }
      return rows;
    }
    return tableRecords.map((r) => buildRow(r));
  })();

  if (eggReportRows.length) {
    const sum = (key) => tableRecords.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    const totalHens = tableRecords.reduce((s, r) => s + (r.birdsAtCollection ?? 0), 0);
    const totalGood = tableStats.marketableEggs;
    const overallRate = totalHens > 0 ? Number(((totalGood / totalHens) * 100).toFixed(2)) : 0;
    eggReportRows.push({
      date: "GRAND TOTAL",
      batchId: "—",
      breed: "—",
      hens: totalHens,
      jumbo: sum("jumbo"),
      extraLarge: sum("extraLarge"),
      large: sum("large"),
      medium: sum("medium"),
      small: sum("small"),
      peewee: sum("peewee"),
      goodEggs: totalGood,
      badEggs: tableStats.crackedEggs,
      totalEggsCol: totalGood + tableStats.crackedEggs,
      productionRate: `Overall: ${overallRate}%`,
    });
  }

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "RECORDS", path: "/records" },
        { label: "EGG RECORD" },
      ]}
    >
        <div className="egg-toolbar">
          <button className="add-egg-btn" onClick={() => navigate("/records/egg/add")}>
            <FiPlus /> Add Egg Record
          </button>

          <div className="egg-toolbar-actions">
            <div className="egg-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="egg-btn-group">
              <div className="egg-filter-wrap" ref={filterRef}>
                <button className="egg-toolbar-btn" onClick={openFilterPanel}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="egg-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
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
                        <div className="egg-filter-group">
                          <label className="egg-filter-label">Week</label>
                          <input
                            type="week"
                            className="egg-filter-select"
                            value={draft.week}
                            onChange={(e) => handleFilterChange("week", e.target.value)}
                          />
                        </div>
                      )}

                      {draft.period === "month" && (
                        <div className="egg-filter-group">
                          <label className="egg-filter-label">Month</label>
                          <select
                            className="egg-filter-select"
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
                        <div className="egg-filter-group">
                          <label className="egg-filter-label">Year</label>
                          <select
                            className="egg-filter-select"
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
                      <div className="egg-filter-group">
                        <label className="egg-filter-label">Start Date / End Date</label>
                        <div className="egg-filter-date-range">
                          <input type="date" className="egg-filter-select" value={draft.dateFrom}
                            max={draft.dateTo || todayStr()}
                            onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label="From date" />
                          <span>to</span>
                          <input type="date" className="egg-filter-select" value={draft.dateTo}
                            min={draft.dateFrom || undefined} max={todayStr()}
                            onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label="To date" />
                        </div>
                      </div>
                    )}

                    <div className="egg-filter-section-label">Filters</div>
                    <div className="egg-filter-row">
                      <div className="egg-filter-group">
                        <label className="egg-filter-label">Report Scope</label>
                        <select
                          className="egg-filter-select"
                          value={draft.reportScope}
                          onChange={(e) => changeReportScope(e.target.value)}
                        >
                          <option value="byBatch">By Batch</option>
                          <option value="byBreed">By Breed</option>
                        </select>
                      </div>

                      {draft.reportScope === "byBatch" && (
                        <div className="egg-filter-group">
                          <label className="egg-filter-label">Batch ID</label>
                          <select
                            className="egg-filter-select"
                            value={draft.batchId}
                            onChange={(e) => handleFilterChange("batchId", e.target.value)}
                          >
                            <option value="All">All Batches</option>
                            {batchOptions.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {draft.reportScope === "byBreed" && (
                        <div className="egg-filter-group">
                          <label className="egg-filter-label">Breed</label>
                          <select
                            className="egg-filter-select"
                            value={draft.breed}
                            onChange={(e) => handleFilterChange("breed", e.target.value)}
                          >
                            <option value="All">All Breeds</option>
                            {breedOptions.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="egg-filter-actions">
                      <button className="egg-filter-clear" onClick={clearFilters}>Clear All</button>
                      <button className="egg-filter-apply" onClick={applyFilters}>Apply</button>
                    </div>
                  </div>
                )}
              </div>

              <ExportMenu
                rows={eggReportRows}
                columns={eggReportColumns}
                name="egg-record"
                title="Egg Production Report"
                meta={exportMeta}
                pdfExtra={{ period: exportMeta.period, summary: exportSummary, hideApprovalAndTagline: true }}
                moduleLabel="Egg Record"
                enablePreview
                filters={{
                  "Report Scope": filters.reportScope === "byBatch" ? "By Batch" : filters.reportScope === "byBreed" ? "By Breed" : "Entire Farm",
                  ...(filters.reportScope === "byBatch" && filters.batchId !== "All" ? { "Batch ID": filters.batchId } : {}),
                  ...(filters.reportScope === "byBreed" && filters.breed !== "All" ? { "Breed": filters.breed } : {}),
                  ...(exportMeta.period !== "—" ? { "Report Period": exportMeta.period } : {}),
                }}
                className="egg-toolbar-btn"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="egg-active-filters" style={{ color: "#d94f4f" }}>
            {error}
          </div>
        )}

        <div className="egg-stats-grid">
          <div className="egg-stat-card">
            <div className="egg-stat-icon gold"><FiLayers /></div>
            <div>
              <h3>{liveStats.totalEggs}</h3>
              <p>Total Eggs</p>
              <span>{statCardPeriodLabel}</span>
            </div>
          </div>

          <div className="egg-stat-card">
            <div className="egg-stat-icon green"><FiCheckCircle /></div>
            <div>
              <h3>{liveStats.marketableEggs}</h3>
              <p>Marketable Eggs</p>
              <span>{statCardPeriodLabel}</span>
            </div>
          </div>

          <div className="egg-stat-card">
            <div className="egg-stat-icon red"><FiAlertTriangle /></div>
            <div>
              <h3>{liveStats.crackedEggs}</h3>
              <p>Cracked Eggs</p>
              <span>{statCardPeriodLabel}</span>
            </div>
          </div>
        </div>

        <div className="egg-table-wrapper">
          <table className="egg-table">
            <thead>
              <tr>
                <th className="egg-sortable-th" onClick={() => cycleSort("date")}>DATE{sortIndicator("date", sortColumn, sortDirection)}</th>
                <th className="egg-sortable-th" onClick={() => cycleSort("batchId")}>BATCH ID{sortIndicator("batchId", sortColumn, sortDirection)}</th>
                <th className="egg-sortable-th" onClick={() => cycleSort("peewee")}>PEEWEE{sortIndicator("peewee", sortColumn, sortDirection)}</th>
                <th className="egg-sortable-th" onClick={() => cycleSort("small")}>SMALL{sortIndicator("small", sortColumn, sortDirection)}</th>
                <th className="egg-sortable-th" onClick={() => cycleSort("medium")}>MEDIUM{sortIndicator("medium", sortColumn, sortDirection)}</th>
                <th className="egg-sortable-th" onClick={() => cycleSort("large")}>LARGE{sortIndicator("large", sortColumn, sortDirection)}</th>
                <th className="egg-sortable-th" onClick={() => cycleSort("extraLarge")}>EXTRA LARGE{sortIndicator("extraLarge", sortColumn, sortDirection)}</th>
                <th className="egg-sortable-th" onClick={() => cycleSort("jumbo")}>JUMBO{sortIndicator("jumbo", sortColumn, sortDirection)}</th>
                <th className="egg-sortable-th" onClick={() => cycleSort("crackedEggs")}>CRACKED EGGS{sortIndicator("crackedEggs", sortColumn, sortDirection)}</th>
                <th className="egg-sortable-th" onClick={() => cycleSort("goodEggs")}>GOOD EGGS{sortIndicator("goodEggs", sortColumn, sortDirection)}</th>
                <th className="egg-sortable-th" onClick={() => cycleSort("totalEggs")}>TOTAL EGGS{sortIndicator("totalEggs", sortColumn, sortDirection)}</th>
                <th className="egg-sortable-th" onClick={() => cycleSort("henDayPercent")}>HEN-DAY %{sortIndicator("henDayPercent", sortColumn, sortDirection)}</th>
                <th>REMARKS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="14" className="egg-empty-state">Loading egg records...</td>
                </tr>
              ) : tableRecords.length === 0 && eggRecords.length > 0 ? (
                <tr>
                  <td colSpan="14" className="egg-empty-state">
                    <div className="egg-empty-content">
                      <FiMaximize />
                      <h3>No egg records found</h3>
                      <p>No matching egg records were found for your search.</p>
                    </div>
                  </td>
                </tr>
              ) : tableRecords.length === 0 ? (
                <tr>
                  <td colSpan="14" className="egg-empty-state">
                    <div className="egg-empty-content">
                      <FiMaximize />
                      <h3>No egg records found</h3>
                      <p>Click Add Egg Record to log your first egg collection.</p>
                      <button
                        className="egg-empty-add-btn"
                        onClick={() => navigate("/records/egg/add")}
                      >
                        <FiPlus /> Add Egg Record
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRecords.map((record) => (
                  <tr key={record._id}>
                    <td>{record.collectionDate  ? new Date(record.collectionDate).toLocaleDateString("en-CA")
                      : "-"}
                    </td>
                    <td><span className="egg-badge">{record.batchId}</span></td>
                    <td>{record.peewee}</td>
                    <td>{record.small}</td>
                    <td>{record.medium}</td>
                    <td>{record.large}</td>
                    <td>{record.extraLarge}</td>
                    <td>{record.jumbo}</td>
                    <td>{record.crackedEggs}</td>
                    <td>{record.goodEggs}</td>
                    <td className="egg-total">{record.totalEggs}</td>
                    <td>{record.henDayPercent}%</td>
                    <td>{renderRemarksCell(record, record.remarks)}</td>
                    <td>
                      <div className="egg-action-buttons">
                        {canEdit && (
                          <button
                            className="egg-action-btn edit"
                            title="Edit"
                            onClick={() => navigate(`/records/egg/edit/${record._id}`)}
                          >
                            <FiEdit2 />
                          </button>
                        )}
                        {canArchive && (
                          <button className="egg-action-btn archive" onClick={() => requestArchive({ module: "Egg Records", moduleKey: "pb_eggs", record: record, name: record.batchId || record.date })} title="Archive">
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

      <ArchiveConfirmModal pending={archivePending} onCancel={cancelArchive} onConfirm={confirmArchive} />

      {viewRecord && (
        <div className="pb-confirm-overlay" onClick={() => setViewRecord(null)}>
          <div className="pb-confirm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, textAlign: "left" }}>
            <h3 className="pb-confirm-title">Egg Record — {viewRecord.batchId}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", margin: "12px 0" }}>
              <div><small>Batch ID</small><p style={{ margin: 0 }}>{viewRecord.batchId}</p></div>
              <div><small>Date</small><p style={{ margin: 0 }}>{viewRecord.collectionDate ? new Date(viewRecord.collectionDate).toLocaleDateString("en-CA") : "—"}</p></div>
              <div style={{ gridColumn: "1 / -1" }}><small>Remarks</small><p style={{ margin: 0 }}>{viewRecord.remarks || "—"}</p></div>
            </div>
            <div className="pb-confirm-actions">
              <button className="pb-confirm-cancel" onClick={() => setViewRecord(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </PageLayout>
  );
}