import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter,
  FiEdit2, FiArchive, FiGrid, FiUsers, FiHeart,
  FiCalendar, FiMaximize,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { useUser } from "../hooks/useUser";
import ExportMenu from "../components/ExportMenu";
import { getFarmInfo } from "../api/profile";
import { listFlocks, archiveFlock, updateFlockStatus } from "../api/flockProfile";
import { listBreeds } from "../api/breed";
import "./Flockprofile.css";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination from "../components/TablePagination";
import "../components/TablePagination.css";

function computeAgeWeeks(dateStr) {
  if (!dateStr) return "";
  const start = new Date(dateStr);
  if (isNaN(start)) return "";
  const weeksElapsed = Math.max(0, Math.floor((Date.now() - start.getTime()) / (86400000 * 7)));
  return `${16 + weeksElapsed} weeks`;
}
function ageWeeksNum(dateStr) {
  if (!dateStr) return null;
  const start = new Date(dateStr);
  if (isNaN(start)) return null;
  const w = Math.max(0, Math.floor((Date.now() - start.getTime()) / (86400000 * 7)));
  return 16 + w;
}

function statusStyle(status) {
  const s = (status || "").toLowerCase();
  if (s === "active")      return { color: "#2e9e6b", bg: "#eaf7f1" };
  if (s === "quarantined") return { color: "#c8930c", bg: "#fdf3e3" };
  if (s === "culled")      return { color: "#444444", bg: "#ececec" };
  return { color: "#666", bg: "#f0f0f0" };
}

const HARDCODED_BREEDS = ["Hy-Line W-36", "Lohmann LSL Lite", "Dekalb White", "Shaver White", "Hendrix White"];
const mergeBreeds = (dynamic) => {
  const merged = [...HARDCODED_BREEDS];
  (dynamic || []).forEach((name) => {
    if (!merged.some((b) => b.toLowerCase() === name.toLowerCase())) merged.push(name);
  });
  return merged;
};

const computeFlock = (f) => {
  const pq = Number(f.quantityPurchased) || 0;
  const tm = f.totalMortality ?? (f.currentQuantity != null ? pq - Number(f.currentQuantity) : 0);
  const cb = f.currentQuantity != null ? Number(f.currentQuantity) : Math.max(0, pq - (Number(tm) || 0));
  const mr = f.mortalityRate != null ? Number(f.mortalityRate) : (pq > 0 ? ((Number(tm) || 0) / pq) * 100 : 0);
  return { cb, mr, ageW: ageWeeksNum(f.dateAcquired) };
};

export default function FlockProfile() {
  const navigate = useNavigate();
  const { canArchive, isOwner } = useUser();
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const defaultFilters = { batchId: "All", breed: "All", status: "All", period: "all", year: "All", month: "All", week: "", dateFrom: "", dateTo: "" };
  const [filters, setFilters] = useState(defaultFilters);
  const [draft, setDraft] = useState(defaultFilters);
  const [filterApplied, setFilterApplied] = useState(false);
  const filterRef = useRef(null);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [pendingCull, setPendingCull] = useState(null);
  const [flocks, setFlocks] = useState([]);
  const [breeds, setBreeds] = useState([]);
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [farmInfo, setFarmInfo] = useState({ farmName: "", farmLocation: "", farmContact: "", farmEmail: "", farmLogo: "" });

  const fetchFlocks = () => {
    setLoading(true);
    setError("");
    listFlocks()
      .then((d) => {
        const list = Array.isArray(d) ? d : d.records || d.data || d.flocks || [];
        setFlocks(list.map((f) => ({
          ...f,
          dateAcquired: f.dateAcquired ? String(f.dateAcquired).slice(0, 10) : f.dateAcquired,
        })));
      })
      .catch((err) => {
        setFlocks([]);
        const msg = err?.message || "";
        if (msg !== "Owner access only.") {
          setError(msg || "Couldn't load flock records.");
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFlocks();
    getFarmInfo().then((d) => setFarmInfo(d)).catch(() => {});
    listBreeds().then((d) => setBreeds(mergeBreeds((d.breeds || []).map((b) => b.name)))).catch(() => setBreeds(HARDCODED_BREEDS));
    window.addEventListener("pb_data_changed", fetchFlocks);
    window.addEventListener("focus", fetchFlocks);
    return () => {
      window.removeEventListener("pb_data_changed", fetchFlocks);
      window.removeEventListener("focus", fetchFlocks);
    };
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleFilterChange = (key, value) => setDraft((f) => ({ ...f, [key]: value }));
  const clearFilters = () => { setDraft(defaultFilters); setFilters(defaultFilters); setFilterApplied(false); };
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
    (filterApplied && filters.batchId !== "All" ? 1 : 0) +
    (filterApplied && filters.breed !== "All" ? 1 : 0) +
    (filterApplied && filters.status !== "All" ? 1 : 0);

  const batchOptions = [...new Set(flocks.map((f) => f.batchId).filter(Boolean))];

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

  const yearOptions = [...new Set(
    flocks.map((f) => { const d = new Date(f.dateAcquired); return isNaN(d) ? null : String(d.getFullYear()); }).filter(Boolean)
  )].sort((a, b) => b - a);

  const monthOptions = [...new Set(
    flocks
      .filter((f) => draft.year === "All" || String(new Date(f.dateAcquired).getFullYear()) === draft.year)
      .map((f) => { const d = new Date(f.dateAcquired); return isNaN(d) ? null : MONTH_NAMES[d.getMonth()]; })
      .filter(Boolean)
  )].sort((a, b) => MONTH_NAMES.indexOf(a) - MONTH_NAMES.indexOf(b));

  const matchesDatePeriod = (r, f) => {
    if (f.period === "all") return true;
    const d = new Date(r.dateAcquired);
    const recYear = isNaN(d) ? null : String(d.getFullYear());
    const recMonth = isNaN(d) ? null : MONTH_NAMES[d.getMonth()];
    if (f.period === "today") return r.dateAcquired === todayStr();
    if (f.period === "week") return !!f.week && isoWeekOf(r.dateAcquired) === f.week;
    if (f.period === "month") return f.year !== "All" && f.month !== "All" && recYear === f.year && recMonth === f.month;
    if (f.period === "year") return f.year !== "All" && recYear === f.year;
    if (f.period === "custom") return (!f.dateFrom || r.dateAcquired >= f.dateFrom) && (!f.dateTo || r.dateAcquired <= f.dateTo);
    return true;
  };

  let filtered = flocks.filter((r) => (
    r.batchId?.toLowerCase().includes(search.toLowerCase()) &&
    (!filterApplied || (
      (filters.batchId === "All" || r.batchId === filters.batchId) &&
      (filters.breed === "All" || r.breed === filters.breed) &&
      (filters.status === "All" || r.status === filters.status) &&
      matchesDatePeriod(r, filters)
    ))
  ));

  const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
  const sortAccessor = (row, col) => {
    if (col === "batchId") return row.batchId || "";
    if (col === "breed") return row.breed || "";
    if (col === "supplier") return row.supplier || "";
    if (col === "dateAcquired") return row.dateAcquired || "";
    if (col === "purchaseQty") return Number(row.quantityPurchased) || 0;
    if (col === "currentBirds") return computeFlock(row).cb ?? 0;
    if (col === "mortalityRate") { const v = computeFlock(row).mr; return typeof v === "number" ? v : 0; }
    if (col === "age") return computeAgeWeeks(row.dateAcquired) || 0;
    if (col === "status") return row.status || "";
    return "";
  };
  const sorted = sortData(filtered, sortAccessor);
  const pager = usePagination(sorted.length);
  useEffect(() => { pager.setPage(1); }, [search, filterApplied, filters, flocks.length]);
  const pageRows = sorted.slice(pager.startIndex, pager.endIndex);

  const statCardSpanLabel = (() => {
    if (!filterApplied || filters.period === "all") return "All Records";
    if (filters.period === "today") return "Today";
    if (filters.period === "week" && filters.week) return filters.week;
    if (filters.period === "month" && filters.month !== "All" && filters.year !== "All") return `${filters.month} ${filters.year}`;
    if (filters.period === "year" && filters.year !== "All") {
      return filters.year === String(new Date().getFullYear()) ? "This Year" : `Year ${filters.year}`;
    }
    if (filters.period === "custom" && (filters.dateFrom || filters.dateTo)) {
      return `${filters.dateFrom || "—"} – ${filters.dateTo || "—"}`;
    }
    return "All Records";
  })();

  const stats = (() => {
    const n = filtered.length;
    let birds = 0, mrSum = 0, ageDaysSum = 0;
    filtered.forEach((f) => {
      const { cb, mr, ageW } = computeFlock(f);
      birds += cb;
      mrSum += mr;
      ageDaysSum += (ageW || 0) * 7;
    });
    return {
      total: n,
      birds,
      avgMortality: n ? mrSum / n : 0,
      avgAge: n ? Math.round(ageDaysSum / n) : 0,
    };
  })();

  const handleArchive = (flock) => setConfirmArchive(flock);

  const runArchiveConfirm = async () => {
    if (!confirmArchive) return;
    try {
      await archiveFlock(confirmArchive._id);
      await fetchFlocks();
    } catch (err) {
      console.error(err);
      alert("Unable to archive flock.");
    } finally {
      setConfirmArchive(null);
    }
  };

  const handleStatusChange = async (flock, newStatus) => {
    if (statusUpdating) return;
    setStatusUpdating(flock._id);
    try {
      await updateFlockStatus(flock._id, newStatus);
      await fetchFlocks();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Unable to update status.");
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleStatusSelect = (flock, newStatus) => {
    if (newStatus === "Culled") {
      setPendingCull(flock);
      return;
    }
    handleStatusChange(flock, newStatus);
  };

  const runCullConfirm = async () => {
    if (!pendingCull) return;
    await handleStatusChange(pendingCull, "Culled");
    setPendingCull(null);
  };

  const periodLabel = statCardSpanLabel;

  const exportMeta = {
    farmName: farmInfo.farmName,
    location: farmInfo.farmLocation,
    contact: farmInfo.farmContact,
    email: farmInfo.farmEmail,
    logoUrl: farmInfo.farmLogo
      ? (farmInfo.farmLogo.startsWith("http") ? farmInfo.farmLogo : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${farmInfo.farmLogo}`)
      : "",
    period: periodLabel,
    fields: [],
  };

  const exportSummary = filtered.length
    ? [
        { label: "Total Flock Records", value: String(stats.total) },
        { label: "Total Current Birds", value: stats.birds.toLocaleString() },
        { label: "Average Mortality Rate", value: `${stats.avgMortality.toFixed(1)}%` },
        { label: "Average Age (Days)", value: String(stats.avgAge) },
      ]
    : [];

  const exportColumns = [
    { key: "batchId", label: "Batch ID" },
    { key: "breed", label: "Breed" },
    { key: "supplier", label: "Supplier" },
    { key: "dateAcquired", label: "Date Acquired" },
    { key: "quantityPurchased", label: "Purchased Quantity" },
    { key: "currentQuantity", label: "Current Birds" },
    { key: "mortalityRateLabel", label: "Mortality Rate" },
    { key: "ageLabel", label: "Age" },
    { key: "status", label: "Status" },
  ];

  const exportRows = filtered.map((f) => {
    const { cb, mr } = computeFlock(f);
    return {
      batchId: f.batchId || "—",
      breed: f.breed || "—",
      supplier: f.supplier || "—",
      dateAcquired: f.dateAcquired ? new Date(f.dateAcquired).toISOString().split("T")[0] : "—",
      quantityPurchased: f.quantityPurchased ?? 0,
      currentQuantity: cb,
      mortalityRateLabel: `${(typeof mr === "number" ? mr : 0).toFixed(2)}%`,
      ageLabel: computeAgeWeeks(f.dateAcquired) || "—",
      status: f.status || "—",
    };
  });

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "RECORDS", path: "/records" },
        { label: "FLOCK PROFILE" },
      ]}
    >
        {}
        <div className="fp-toolbar">
          {isOwner && (
            <button className="fp-add-btn" onClick={() => navigate("/records/flock/add")}>
              <FiPlus /> Add New Flock
            </button>
          )}
          <div className="fp-toolbar-right">
            <div className="fp-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="fp-btn-group">
              <div className="fp-filter-wrap" ref={filterRef}>
                <button className="fp-toolbar-btn" onClick={openFilterPanel}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="fp-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="fp-filter-dropdown">
                    <div className="fp-filter-dropdown-header">
                      <span>Filter Flocks</span>
                    </div>

                    <div className="fp-filter-section-label">Date Filter</div>
                    <div className="fp-filter-row">
                      <div className="fp-filter-group">
                        <label className="fp-filter-label">Date Period</label>
                        <select
                          className="fp-filter-select"
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
                        <div className="fp-filter-group">
                          <label className="fp-filter-label">Week</label>
                          <input
                            type="week"
                            className="fp-filter-select"
                            value={draft.week}
                            onChange={(e) => handleFilterChange("week", e.target.value)}
                          />
                        </div>
                      )}

                      {draft.period === "month" && (
                        <div className="fp-filter-group">
                          <label className="fp-filter-label">Month</label>
                          <select
                            className="fp-filter-select"
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
                        <div className="fp-filter-group">
                          <label className="fp-filter-label">Year</label>
                          <select
                            className="fp-filter-select"
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
                      <div className="fp-filter-group">
                        <label className="fp-filter-label">Start Date / End Date</label>
                        <div className="fp-filter-date-range">
                          <input type="date" className="fp-filter-select" value={draft.dateFrom}
                            max={draft.dateTo || todayStr()}
                            onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label="From date" />
                          <span>to</span>
                          <input type="date" className="fp-filter-select" value={draft.dateTo}
                            min={draft.dateFrom || undefined} max={todayStr()}
                            onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label="To date" />
                        </div>
                      </div>
                    )}

                    <div className="fp-filter-section-label">Filters</div>
                    <div className="fp-filter-row">
                      <div className="fp-filter-group">
                        <label className="fp-filter-label">Batch ID</label>
                        <select
                          className="fp-filter-select"
                          value={draft.batchId}
                          onChange={(e) => handleFilterChange("batchId", e.target.value)}
                        >
                          <option value="All">All Batches</option>
                          {batchOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>

                      <div className="fp-filter-group">
                        <label className="fp-filter-label">Breed</label>
                        <select
                          className="fp-filter-select"
                          value={draft.breed}
                          onChange={(e) => handleFilterChange("breed", e.target.value)}
                        >
                          <option value="All">All Breeds</option>
                          {breeds.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>

                      <div className="fp-filter-group">
                        <label className="fp-filter-label">Status</label>
                        <select
                          className="fp-filter-select"
                          value={draft.status}
                          onChange={(e) => handleFilterChange("status", e.target.value)}
                        >
                          <option value="All">All</option>
                          <option value="Active">Active</option>
                          <option value="Quarantined">Quarantined</option>
                          <option value="Culled">Culled</option>
                        </select>
                      </div>
                    </div>

                    <div className="fp-filter-actions">
                      <button className="fp-filter-clear" onClick={clearFilters}>Clear All</button>
                      <button className="fp-filter-apply" onClick={applyFilters}>Apply</button>
                    </div>
                  </div>
                )}
              </div>

              <ExportMenu
                rows={exportRows}
                columns={exportColumns}
                name="flock-profiles"
                title="Flock Inventory Report"
                meta={exportMeta}
                pdfExtra={{ period: exportMeta.period, summary: exportSummary, hideApprovalAndTagline: true }}
                moduleLabel="Flock Profile"
                enablePreview
                filters={{
                  ...(filters.batchId !== "All" ? { "Batch ID": filters.batchId } : {}),
                  ...(filters.breed !== "All" ? { "Breed": filters.breed } : {}),
                  ...(filters.status !== "All" ? { "Status": filters.status } : {}),
                  ...(filterApplied && filters.period !== "all" ? { "Report Period": periodLabel } : {}),
                }}
                className="fp-toolbar-btn"
              />
            </div>
          </div>
        </div>

        {error && <div className="fp-active-filters" style={{ color: "#d94f4f" }}>{error}</div>}

        {}
        <div className="fp-stats-grid">
          <div className="fp-stat-card">
            <div className="fp-stat-icon gold"><FiGrid /></div>
            <div>
              <h3>{stats.total}</h3>
              <p>Total Flock Records</p>
              <span>{statCardSpanLabel}</span>
            </div>
          </div>
          <div className="fp-stat-card">
            <div className="fp-stat-icon green"><FiUsers /></div>
            <div>
              <h3>{stats.birds.toLocaleString()}</h3>
              <p>Total Current Birds</p>
              <span>{statCardSpanLabel}</span>
            </div>
          </div>
          <div className="fp-stat-card">
            <div className="fp-stat-icon red"><FiHeart /></div>
            <div>
              <h3>{stats.avgMortality.toFixed(1)}%</h3>
              <p>Average Mortality Rate</p>
              <span>{statCardSpanLabel}</span>
            </div>
          </div>
          <div className="fp-stat-card">
            <div className="fp-stat-icon blue"><FiCalendar /></div>
            <div>
              <h3>{stats.avgAge}</h3>
              <p>Average Age (Days)</p>
              <span>{statCardSpanLabel}</span>
            </div>
          </div>
        </div>

        {}
        <div className="fp-table-wrapper">
          <table className="fp-table">
            <thead>
              <tr>
                <th className="fp-sortable-th" onClick={() => cycleSort("batchId")}>BATCH ID{sortIndicator("batchId", sortColumn, sortDirection)}</th>
                <th className="fp-sortable-th" onClick={() => cycleSort("breed")}>BREED{sortIndicator("breed", sortColumn, sortDirection)}</th>
                <th className="fp-sortable-th" onClick={() => cycleSort("supplier")}>SUPPLIER{sortIndicator("supplier", sortColumn, sortDirection)}</th>
                <th className="fp-sortable-th" onClick={() => cycleSort("dateAcquired")}>DATE ACQUIRED{sortIndicator("dateAcquired", sortColumn, sortDirection)}</th>
                <th className="fp-sortable-th" onClick={() => cycleSort("purchaseQty")}>Purchased Quantity{sortIndicator("purchaseQty", sortColumn, sortDirection)}</th>
                <th className="fp-sortable-th" onClick={() => cycleSort("currentBirds")}>CURRENT BIRDS{sortIndicator("currentBirds", sortColumn, sortDirection)}</th>
                <th className="fp-sortable-th" onClick={() => cycleSort("mortalityRate")}>MORTALITY RATE{sortIndicator("mortalityRate", sortColumn, sortDirection)}</th>
                <th className="fp-sortable-th" onClick={() => cycleSort("age")}>AGE{sortIndicator("age", sortColumn, sortDirection)}</th>
                <th className="fp-sortable-th" onClick={() => cycleSort("status")}>STATUS{sortIndicator("status", sortColumn, sortDirection)}</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="10" className="fp-empty-state">Loading flock records...</td></tr>
              ) : filtered.length === 0 && flocks.length > 0 ? (
                <tr>
                  <td colSpan="10" className="fp-empty-state">
                    <div className="fp-empty-content">
                      <FiMaximize />
                      <h3>No flock records found</h3>
                      <p>No matching flock records were found for your search.</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="10" className="fp-empty-state">
                    <div className="fp-empty-content">
                      <FiMaximize />
                      <h3>No flock records found</h3>
                      <p>{isOwner ? "Click Add New Flock to create your first flock profile." : "No flock records to display."}</p>
                      {isOwner && (
                        <button className="fp-empty-add-btn" onClick={() => navigate("/records/flock/add")}>
                          <FiPlus /> Add New Flock
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((flock) => {
                  const { cb, mr } = computeFlock(flock);
                  return (
                    <tr key={flock._id || flock.batchId}>
                      <td><span className="fp-batch-badge">{flock.batchId}</span></td>
                      <td>{flock.breed}</td>
                      <td>{flock.supplier}</td>
                      <td>{flock.dateAcquired ? new Date(flock.dateAcquired).toLocaleDateString("en-CA")
                      : "—"}</td>
                      <td>{flock.quantityPurchased}</td>
                      <td>{cb}</td>
                      <td>{typeof mr === "number" ? mr.toFixed(2) : mr}%</td>
                      <td>{computeAgeWeeks(flock.dateAcquired) || "—"}</td>
                      <td>
                        {flock.status !== "Active" ? (
                          <span className="fp-status-badge" style={{ background: statusStyle(flock.status).bg, color: statusStyle(flock.status).color }}>
                            {flock.status}
                          </span>
                        ) : (
                          <select
                            className="fp-status-select"
                            style={{ background: statusStyle(flock.status).bg, color: statusStyle(flock.status).color }}
                            value={flock.status}
                            disabled={!isOwner || statusUpdating === flock._id}
                            onChange={(e) => handleStatusSelect(flock, e.target.value)}
                          >
                            <option value="Active">Active</option>
                            <option value="Culled">Culled</option>
                          </select>
                        )}
                      </td>
                      <td>
                        <div className="fp-actions">
                          {isOwner && (
                          <button className="fp-btn-edit" title="Edit"
                            onClick={() => navigate(`/records/flock/edit/${flock._id || flock.batchId}`)}>
                            <FiEdit2 />
                          </button>
                          )}
                          {canArchive && (
                          <button className="fp-btn-archive" title="Archive" onClick={() => handleArchive(flock)}>
                            <FiArchive />
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      {}
      {confirmArchive && (
        <div className="fp-confirm-overlay" onClick={() => setConfirmArchive(null)}>
          <div className="fp-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="fp-confirm-title">Archive Flock</h3>
            <p className="fp-confirm-message">
              Move batch "{confirmArchive.batchId}" to the archive? You can restore it anytime from the Archive page.
            </p>
            <div className="fp-confirm-actions">
              <button className="fp-confirm-cancel" onClick={() => setConfirmArchive(null)}>Cancel</button>
              <button className="fp-confirm-archive" onClick={runArchiveConfirm}>Archive</button>
            </div>
          </div>
        </div>
      )}

      {}
      {pendingCull && (
        <div className="fp-confirm-overlay" onClick={() => !statusUpdating && setPendingCull(null)}>
          <div className="fp-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="fp-confirm-title">Confirm Culling</h3>
            <p className="fp-confirm-message">
              Are you sure you want to cull this flock?
              <br /><br />
              <strong>Batch ID:</strong> {pendingCull.batchId}<br />
              <strong>Breed:</strong> {pendingCull.breed}<br />
              <strong>Current Birds:</strong> {pendingCull.currentQuantity}
              <br /><br />
              This action will mark the flock as Culled and record the current birds as mortality.
            </p>
            <div className="fp-confirm-actions">
              <button className="fp-confirm-cancel" onClick={() => setPendingCull(null)} disabled={statusUpdating === pendingCull._id}>
                Cancel
              </button>
              <button className="fp-confirm-archive" onClick={runCullConfirm} disabled={statusUpdating === pendingCull._id}>
                {statusUpdating === pendingCull._id ? "Culling..." : "Confirm Culling"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}