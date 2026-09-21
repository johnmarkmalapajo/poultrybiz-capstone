import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter,
  FiEdit2, FiArchive, FiMaximize, FiShield, FiEye,
  FiClipboard, FiCheckCircle, FiHeart, FiAlertCircle,
  FiChevronDown,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { useUser } from "../hooks/useUser";
import ExportMenu from "../components/ExportMenu";
import "./QuarantineandIsolation.css";
import { archiveRow } from "../archiveRow";
import { useArchiveConfirm } from "../hooks/useArchiveConfirm";
import ArchiveConfirmModal from "../components/ArchiveConfirmModal";
import { listQuarantineRecords, updateQuarantineStatus, updateIsolationProgress, correctIsolationProgress } from "../api/quarantineIsolation";
import { getFarmInfo } from "../api/profile";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination from "../components/TablePagination";
import "../components/TablePagination.css";

export default function QuarantineIsolation() {
  const navigate = useNavigate();
  const { canEdit, canArchive } = useUser();
  const { pending: archivePending, requestArchive, cancelArchive, confirmArchive } = useArchiveConfirm();
  const [params] = useSearchParams();

  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const defaultFilters = { batchId: "All", period: "all", year: "All", month: "All", week: "", dateFrom: "", dateTo: "" };
  const [filters, setFilters] = useState(defaultFilters);
  const [draft, setDraft] = useState(defaultFilters);
  const [filterApplied, setFilterApplied] = useState(false);
  const filterRef = useRef(null);
  const [activeTab, setActiveTab] = useState(
    params.get("tab") === "isolation" ? "isolation" : "quarantine"
  );
  const [farmInfo, setFarmInfo] = useState({ farmName: "", farmLocation: "", farmContact: "", farmEmail: "", farmLogo: "" });
  const [viewRecord, setViewRecord] = useState(null);
  const [pendingRelease, setPendingRelease] = useState(null);
  const [releaseSaving, setReleaseSaving] = useState(false);

  const [progressRecord, setProgressRecord] = useState(null);
  const [progressMode, setProgressMode] = useState("view");
  const [correctingId, setCorrectingId] = useState(null);
  const [progForm, setProgForm] = useState({ date: "", recovered: "", deceased: "" });
  const [progConfirming, setProgConfirming] = useState(false);
  const [progSaving, setProgSaving] = useState(false);
  const [progError, setProgError] = useState("");

  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await listQuarantineRecords();
      const list = Array.isArray(data) ? data : data.records || data.data || [];
      setAllRecords(list);
    } catch (err) {
      setAllRecords([]);
      setError(err?.message || "Couldn't load quarantine & isolation records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    getFarmInfo().then((d) => setFarmInfo(d)).catch(() => {});
  }, []);

  const confirmRelease = async () => {
    if (!pendingRelease || releaseSaving) return;
    setReleaseSaving(true);
    try {
      await updateQuarantineStatus(pendingRelease._id, "Released");
      setPendingRelease(null);
      await fetchRecords();
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch {}
    } catch (err) {
      setError(err?.message || "Couldn't release this batch from quarantine. Please try again.");
    } finally {
      setReleaseSaving(false);
    }
  };

  const today = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  })();

  const openProgressModal = (record) => {
    setProgressRecord(record);
    setProgressMode("view");
    setCorrectingId(null);
    setProgForm({ date: "", recovered: "", deceased: "" });
    setProgConfirming(false);
    setProgError("");
  };

  const closeProgressModal = () => {
    if (progSaving) return;
    setProgressRecord(null);
    setProgressMode("view");
    setCorrectingId(null);
    setProgConfirming(false);
    setProgError("");
  };

  const startAddUpdate = () => {
    setProgressMode("add");
    setCorrectingId(null);
    setProgForm({ date: "", recovered: "", deceased: "" });
    setProgConfirming(false);
    setProgError("");
  };

  const startCorrectEntry = (entry) => {
    setProgressMode("correct");
    setCorrectingId(entry._id);
    setProgForm({
      date: entry.date || "",
      recovered: String(entry.recoveredDelta ?? 0),
      deceased: String(entry.deceasedDelta ?? 0),
    });
    setProgConfirming(false);
    setProgError("");
  };

  const cancelProgAction = () => {
    setProgressMode("view");
    setCorrectingId(null);
    setProgConfirming(false);
    setProgError("");
  };

  const requestProgConfirm = () => {
    const rec = progForm.recovered === "" ? 0 : Number(progForm.recovered);
    const dec = progForm.deceased === "" ? 0 : Number(progForm.deceased);

    if (!Number.isInteger(rec) || !Number.isInteger(dec) || rec < 0 || dec < 0) {
      setProgError("Recovered and Deceased must be whole numbers, zero or greater.");
      return;
    }
    if (progressMode === "add") {
      if (rec === 0 && dec === 0) {
        setProgError("Enter at least one Recovered or Deceased update.");
        return;
      }
      if (rec + dec > progressRecord.remaining) {
        setProgError(`Recovered + Deceased (${rec + dec}) exceeds Remaining (${progressRecord.remaining}).`);
        return;
      }
    } else if (progressMode === "correct") {
      const entry = progressRecord.progressUpdates.find((e) => e._id === correctingId);
      const otherRecovered = progressRecord.recovered - (entry?.recoveredDelta || 0);
      const otherDeceased = progressRecord.deceased - (entry?.deceasedDelta || 0);
      if (otherRecovered + rec + otherDeceased + dec > progressRecord.headCount) {
        setProgError(`Corrected totals would exceed Number of Birds Isolated (${progressRecord.headCount}).`);
        return;
      }
    }
    setProgError("");
    setProgConfirming(true);
  };

  const confirmProgSave = async () => {
    if (progSaving) return;
    setProgSaving(true);
    setProgError("");
    const rec = progForm.recovered === "" ? 0 : Number(progForm.recovered);
    const dec = progForm.deceased === "" ? 0 : Number(progForm.deceased);
    try {
      let result;
      if (progressMode === "add") {
        result = await updateIsolationProgress(progressRecord._id, {
          recoveredDelta: rec,
          deceasedDelta: dec,
          date: progForm.date || today,
        });
      } else {
        result = await correctIsolationProgress(progressRecord._id, correctingId, {
          recoveredDelta: rec,
          deceasedDelta: dec,
          date: progForm.date || undefined,
        });
      }
      const updated = result.record || result;
      setProgressRecord(updated);
      setProgressMode("view");
      setCorrectingId(null);
      setProgConfirming(false);
      setProgForm({ date: "", recovered: "", deceased: "" });
      await fetchRecords();
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch {}
    } catch (err) {
      setProgError(err?.message || "Couldn't save this update. Please try again.");
      setProgConfirming(false);
    } finally {
      setProgSaving(false);
    }
  };

  const quarantineRecords = allRecords.filter((r) => r.recordType !== "Isolation");
  const isolationRecords = allRecords.filter((r) => r.recordType === "Isolation");

  useEffect(() => {
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const isQuarantine = activeTab === "quarantine";

  const handleFilterChange = (key, value) => setDraft((f) => ({ ...f, [key]: value }));
  const clearFilters = () => { setDraft(defaultFilters); setFilters(defaultFilters); setFilterApplied(false); };

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

  const matchesDatePeriod = (r, f, dateField) => {
    if (f.period === "all") return true;
    const raw = r[dateField] || "";
    const d = new Date(raw);
    const recYear = isNaN(d) ? null : String(d.getFullYear());
    const recMonth = isNaN(d) ? null : MONTH_NAMES[d.getMonth()];
    if (f.period === "today") return raw === todayStr();
    if (f.period === "week") return !!f.week && isoWeekOf(raw) === f.week;
    if (f.period === "month") return f.year !== "All" && f.month !== "All" && recYear === f.year && recMonth === f.month;
    if (f.period === "year") return f.year !== "All" && recYear === f.year;
    if (f.period === "custom") return (!f.dateFrom || raw >= f.dateFrom) && (!f.dateTo || raw <= f.dateTo);
    return true;
  };

  const applyFilters = () => {
    if (draft.period === "custom") {
      const today = todayStr();
      if (draft.dateFrom && draft.dateFrom > today) { setError("Start date cannot be a future date."); return; }
      if (draft.dateTo && draft.dateTo > today) { setError("End date cannot be a future date."); return; }
      if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) { setError("Start date cannot be later than end date."); return; }
    }
    setError("");
    setFilters(draft);
    setFilterApplied(true);
    setShowFilter(false);
  };
  const openFilterPanel = () => { setDraft(filters); setShowFilter((s) => !s); };
  const activeFilterCount =
    (filterApplied && filters.period !== "all" ? 1 : 0) +
    (filterApplied && filters.batchId !== "All" ? 1 : 0);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearch("");
    setDraft(defaultFilters);
    setFilters(defaultFilters);
    setFilterApplied(false);
    setShowFilter(false);
  };

  const activeSource = isQuarantine ? quarantineRecords : isolationRecords;
  const uniq = (vals) => [...new Set(vals.filter(Boolean))];
  const batchOptions = uniq(activeSource.map((r) => r.batchId));

  const activeDateField = isQuarantine ? "dateAcquired" : "dateIsolated";
  const yearOptions = uniq(
    activeSource.map((r) => { const d = new Date(r[activeDateField] || ""); return isNaN(d) ? null : String(d.getFullYear()); })
  ).sort((a, b) => b - a);
  const monthOptions = uniq(
    activeSource
      .filter((r) => draft.year === "All" || String(new Date(r[activeDateField] || "").getFullYear()) === draft.year)
      .map((r) => { const d = new Date(r[activeDateField] || ""); return isNaN(d) ? null : MONTH_NAMES[d.getMonth()]; })
  ).sort((a, b) => MONTH_NAMES.indexOf(a) - MONTH_NAMES.indexOf(b));

  const filteredQuarantine = quarantineRecords.filter((r) =>
    r.batchId?.toLowerCase().includes(search.toLowerCase()) &&
    (!filterApplied || (
      (filters.batchId === "All" || r.batchId === filters.batchId) &&
      matchesDatePeriod(r, filters, "dateAcquired")
    ))
  );

  const filteredIsolation = isolationRecords.filter((r) =>
    r.batchId?.toLowerCase().includes(search.toLowerCase()) &&
    (!filterApplied || (
      (filters.batchId === "All" || r.batchId === filters.batchId) &&
      matchesDatePeriod(r, filters, "dateIsolated")
    ))
  );

  const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
  const quarantineAccessor = (row, col) => {
    if (col === "batchId") return row.batchId || "";
    if (col === "dateAcquired") return row.dateAcquired || "";
    if (col === "source") return row.source || "";
    if (col === "breed") return row.breed || "";
    if (col === "headCount") return Number(row.headCount) || 0;
    if (col === "releasedDate") return row.releasedDate || "";
    if (col === "status") return row.status || "";
    return "";
  };
  const isolationAccessor = (row, col) => {
    if (col === "batchId") return row.batchId || "";
    if (col === "dateIsolated") return row.dateIsolated || "";
    if (col === "headCount") return Number(row.headCount) || 0;
    if (col === "location") return row.location || "";
    if (col === "recovered") return Number(row.recovered) || 0;
    if (col === "deceased") return Number(row.deceased) || 0;
    if (col === "remaining") return Number(row.remaining) || 0;
    if (col === "dateCompleted") return row.dateCompleted || "";
    if (col === "currentStatus") return row.currentStatus || "";
    return "";
  };
  const sortedQuarantine = sortData(filteredQuarantine, quarantineAccessor);
  const sortedIsolation = sortData(filteredIsolation, isolationAccessor);
  const activeSorted = isQuarantine ? sortedQuarantine : sortedIsolation;
  const pager = usePagination(activeSorted.length);
  useEffect(() => { pager.setPage(1); }, [search, filterApplied, filters, activeTab]);
  const pageQuarantine = sortedQuarantine.slice(pager.startIndex, pager.endIndex);
  const pageIsolation = sortedIsolation.slice(pager.startIndex, pager.endIndex);

  const statusClass = (status) => {
    const s = (status || "").toLowerCase();
    if (s.includes("isolat"))  return "qi-status qi-status-isolate";
    if (s.includes("recover")) return "qi-status qi-status-recovered";
    if (s.includes("deceas"))  return "qi-status qi-status-deceased";
    if (s.includes("complet")) return "qi-status qi-status-completed";
    if (s.includes("ongoing")) return "qi-status qi-status-ongoing";
    if (s.includes("release")) return "qi-status qi-status-released";
    if (s.includes("active"))  return "qi-status qi-status-active";
    return "qi-status";
  };

  const countBy = (arr, field, val) =>
    arr.filter((r) => (r[field] || "").toLowerCase() === val).length;

  const qTotal = filteredQuarantine.length;
  const qOngoing = countBy(filteredQuarantine, "status", "ongoing");
  const qReleased =
    countBy(filteredQuarantine, "status", "released") + countBy(filteredQuarantine, "status", "cleared");
  const qHeads = filteredQuarantine.filter((r) => r.status === "Ongoing").reduce((s, r) => s + (Number(r.headCount) || 0), 0);

  const iTotal = filteredIsolation.length;
  const iIsolation = filteredIsolation.reduce((s, r) => s + (Number(r.remaining) || 0), 0);
  const iRecovered = filteredIsolation.reduce((s, r) => s + (Number(r.recovered) || 0), 0);
  const iDeceased = filteredIsolation.reduce((s, r) => s + (Number(r.deceased) || 0), 0);

  const addRoute = `/records/quarantine/add?type=${isQuarantine ? "quarantine" : "isolation"}`;
  const addLabel = isQuarantine ? "Add Quarantine Record" : "Add Isolation Record";

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

  const periodLabel = statCardSpanLabel;

  const farmMeta = {
    farmName: farmInfo.farmName,
    location: farmInfo.farmLocation,
    contact: farmInfo.farmContact,
    email: farmInfo.farmEmail,
    logoUrl: farmInfo.farmLogo
      ? (farmInfo.farmLogo.startsWith("http") ? farmInfo.farmLogo : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${farmInfo.farmLogo}`)
      : "",
    period: periodLabel,
    fields: filters.batchId !== "All" ? [{ label: "Batch ID", value: filters.batchId }] : [],
  };

  const exportTitle = isQuarantine ? "Quarantine Report" : "Isolation Report";
  const quarantineExportColumns = [
    { key: "batchId", label: "Batch ID" },
    { key: "breed", label: "Breed" },
    { key: "supplier", label: "Supplier" },
    { key: "dateAcquired", label: "Date Acquired" },
    { key: "headCount", label: "Head Count" },
    { key: "vitaminsGiven", label: "Vitamins Given" },
    { key: "releasedDate", label: "Date Released" },
    { key: "status", label: "Status" },
  ];
  const quarantineExportRows = filteredQuarantine.map((r) => ({
    batchId: r.batchId || "—",
    breed: r.breed || "—",
    supplier: r.source || "—",
    dateAcquired: r.dateAcquired ? new Date(r.dateAcquired).toISOString().split("T")[0] : "—",
    headCount: r.headCount ?? 0,
    vitaminsGiven: r.vitaminsGiven || "—",
    releasedDate: r.releasedDate || "—",
    status: r.status || "—",
  }));
  const isolationExportColumns = [
    { key: "batchId", label: "Batch ID" },
    { key: "dateIsolated", label: "Date Isolated" },
    { key: "headCount", label: "Number of Birds Isolated" },
    { key: "symptoms", label: "Symptoms/Reasons" },
    { key: "location", label: "Location" },
    { key: "recovered", label: "Recovered" },
    { key: "deceased", label: "Deceased" },
    { key: "remaining", label: "Remaining" },
    { key: "dateCompleted", label: "Date Completed" },
    { key: "currentStatus", label: "Status" },
  ];
  const isolationExportRows = filteredIsolation.map((r) => ({
    batchId: r.batchId || "—",
    dateIsolated: r.dateIsolated || "—",
    headCount: r.headCount ?? 0,
    symptoms: r.symptoms || "—",
    location: r.location || "—",
    recovered: r.recovered ?? 0,
    deceased: r.deceased ?? 0,
    remaining: r.remaining ?? 0,
    dateCompleted: r.dateCompleted || "—",
    currentStatus: r.currentStatus || "—",
  }));
  const exportRows = isQuarantine ? quarantineExportRows : isolationExportRows;
  const exportSummary = isQuarantine
    ? [
        { label: "Total Quarantine", value: String(qTotal) },
        { label: "Ongoing", value: String(qOngoing) },
        { label: "Cleared / Released", value: String(qReleased) },
        { label: "Total Head Count", value: String(qHeads) },
      ]
    : [
        { label: "Total Isolation", value: String(iTotal) },
        { label: "In Isolation", value: String(iIsolation) },
        { label: "Recovered", value: String(iRecovered) },
        { label: "Deceased", value: String(iDeceased) },
      ];

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "RECORDS", path: "/records" },
        { label: "QUARANTINE AND ISOLATION" },
      ]}
    >

        {}
        <div className="qi-toolbar">
          {!isQuarantine && (
            <button className="qi-add-btn" onClick={() => navigate(addRoute)}>
              <FiPlus /> {addLabel}
            </button>
          )}
          <div className="qi-toolbar-right">
            <div className="qi-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="qi-btn-group">
              <div className="qi-filter-wrap" ref={filterRef}>
                <button className="qi-toolbar-btn" onClick={openFilterPanel}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="qi-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="qi-filter-dropdown">
                    <div className="qi-filter-dropdown-header">
                      <span>Filter {isQuarantine ? "Quarantine" : "Isolation"} Records</span>
                    </div>

                    <div className="qi-filter-section-label">Date Filter</div>
                    <div className="qi-filter-row">
                      <div className="qi-filter-group">
                        <label className="qi-filter-label">Date Period</label>
                        <select
                          className="qi-filter-select"
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
                        <div className="qi-filter-group">
                          <label className="qi-filter-label">Week</label>
                          <input
                            type="week"
                            className="qi-filter-select"
                            value={draft.week}
                            onChange={(e) => handleFilterChange("week", e.target.value)}
                          />
                        </div>
                      )}

                      {draft.period === "month" && (
                        <div className="qi-filter-group">
                          <label className="qi-filter-label">Month</label>
                          <select
                            className="qi-filter-select"
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
                        <div className="qi-filter-group">
                          <label className="qi-filter-label">Year</label>
                          <select
                            className="qi-filter-select"
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
                      <div className="qi-filter-group">
                        <label className="qi-filter-label">Start Date / End Date</label>
                        <div className="qi-filter-date-range">
                          <input type="date" className="qi-filter-select" value={draft.dateFrom}
                            max={draft.dateTo || todayStr()}
                            onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label="From date" />
                          <span>to</span>
                          <input type="date" className="qi-filter-select" value={draft.dateTo}
                            min={draft.dateFrom || undefined} max={todayStr()}
                            onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label="To date" />
                        </div>
                      </div>
                    )}

                    <div className="qi-filter-section-label">Filters</div>
                    <div className="qi-filter-group">
                      <label className="qi-filter-label">Batch ID</label>
                      <select
                        className="qi-filter-select"
                        value={draft.batchId}
                        onChange={(e) => handleFilterChange("batchId", e.target.value)}
                      >
                        <option value="All">All Batches</option>
                        {batchOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div className="qi-filter-actions">
                      <button className="qi-filter-clear" onClick={clearFilters}>Clear All</button>
                      <button className="qi-filter-apply" onClick={applyFilters}>Apply</button>
                    </div>
                  </div>
                )}
              </div>

              <ExportMenu
                rows={exportRows}
                columns={isQuarantine ? quarantineExportColumns : isolationExportColumns}
                name={isQuarantine ? "quarantine-record" : "isolation-record"}
                title={exportTitle}
                meta={farmMeta}
                pdfExtra={{ period: farmMeta.period, summary: exportSummary }}
                moduleLabel={isQuarantine ? "Quarantine & Isolation — Quarantine" : "Quarantine & Isolation — Isolation"}
                enablePreview
                filters={{
                  ...(filters.batchId !== "All" ? { "Batch ID": filters.batchId } : {}),
                  ...(filterApplied && filters.period !== "all" ? { "Report Period": periodLabel } : {}),
                }}
                className="qi-toolbar-btn"
              />
            </div>
          </div>
        </div>

        {error && <div className="qi-active-filters" style={{ color: "#d94f4f" }}>{error}</div>}

        <div className="qi-stats-grid">
          {isQuarantine ? (
            <>
              <div className="qi-stat-card">
                <div className="qi-stat-icon gold"><FiClipboard /></div>
                <div><h3>{qTotal}</h3><p>Total Quarantine</p><span>{statCardSpanLabel}</span></div>
              </div>
              <div className="qi-stat-card">
                <div className="qi-stat-icon blue"><FiShield /></div>
                <div><h3>{qOngoing}</h3><p>Ongoing</p><span>{statCardSpanLabel}</span></div>
              </div>
              <div className="qi-stat-card">
                <div className="qi-stat-icon green"><FiCheckCircle /></div>
                <div><h3>{qReleased}</h3><p>Cleared / Released</p><span>{statCardSpanLabel}</span></div>
              </div>
              <div className="qi-stat-card">
                <div className="qi-stat-icon gold"><FiClipboard /></div>
                <div><h3>{qHeads}</h3><p>Total Head Count</p><span>{statCardSpanLabel}</span></div>
              </div>
            </>
          ) : (
            <>
              <div className="qi-stat-card">
                <div className="qi-stat-icon gold"><FiClipboard /></div>
                <div><h3>{iTotal}</h3><p>Total Isolation</p><span>{statCardSpanLabel}</span></div>
              </div>
              <div className="qi-stat-card">
                <div className="qi-stat-icon blue"><FiAlertCircle /></div>
                <div><h3>{iIsolation}</h3><p>In Isolation</p><span>{statCardSpanLabel}</span></div>
              </div>
              <div className="qi-stat-card">
                <div className="qi-stat-icon green"><FiCheckCircle /></div>
                <div><h3>{iRecovered}</h3><p>Recovered</p><span>{statCardSpanLabel}</span></div>
              </div>
              <div className="qi-stat-card">
                <div className="qi-stat-icon red"><FiHeart /></div>
                <div><h3>{iDeceased}</h3><p>Deceased</p><span>{statCardSpanLabel}</span></div>
              </div>
            </>
          )}
        </div>

        {}
        <div className="qi-tabs">
          <button
            className={`qi-tab ${isQuarantine ? "active" : ""}`}
            onClick={() => handleTabChange("quarantine")}
          >
            <FiShield /> Quarantine Record
          </button>
          <button
            className={`qi-tab ${!isQuarantine ? "active" : ""}`}
            onClick={() => handleTabChange("isolation")}
          >
            <FiAlertCircle /> Isolation Record
          </button>
        </div>

        {}
        <div className="qi-table-wrapper">

          {}
          {isQuarantine && (
            <table className="qi-table">
              <thead>
                <tr>
                  <th className="qi-sortable-th" onClick={() => cycleSort("batchId")}>BATCH ID{sortIndicator("batchId", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("breed")}>BREED{sortIndicator("breed", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("source")}>SUPPLIER{sortIndicator("source", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("dateAcquired")}>DATE ACQUIRED{sortIndicator("dateAcquired", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("headCount")}>HEAD COUNT{sortIndicator("headCount", sortColumn, sortDirection)}</th>
                  <th>VITAMINS GIVEN</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("releasedDate")}>DATE RELEASED{sortIndicator("releasedDate", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("status")}>STATUS{sortIndicator("status", sortColumn, sortDirection)}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="qi-empty-state">Loading quarantine records...</td></tr>
                ) : filteredQuarantine.length === 0 && quarantineRecords.length > 0 ? (
                  <tr>
                    <td colSpan="8" className="qi-empty-state">
                      <div className="qi-empty-content">
                        <FiMaximize />
                        <h3>No quarantine and isolation records found</h3>
                        <p>No matching quarantine records were found for your search.</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredQuarantine.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="qi-empty-state">
                      <div className="qi-empty-content">
                        <FiMaximize />
                        <h3>No quarantine and isolation records found</h3>
                        <p>Quarantine records are created automatically when a new flock's age requires quarantine.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageQuarantine.map((r) => (
                    <tr key={r._id}>
                      <td><span className="qi-batch-badge">{r.batchId}</span></td>
                      <td>{r.breed || "—"}</td>
                      <td>{r.source}</td>
                      <td>{r.dateAcquired  ? new Date(r.dateAcquired).toISOString().split("T")[0]
                        : "—"}</td>
                      <td className="qi-center">{r.headCount}</td>
                      <td>{r.vitaminsGiven || "—"}</td>
                      <td>{r.releasedDate || "—"}</td>
                      <td>
                        <select
                          className={`qi-status-select ${statusClass(r.status)}`}
                          value={r.status}
                          disabled={r.status !== "Ongoing" || !canEdit}
                          onChange={(e) => {
                            if (e.target.value === "Released") setPendingRelease(r);
                          }}
                        >
                          <option value="Ongoing">Ongoing</option>
                          <option value="Released" disabled={r.status !== "Ongoing"}>Released</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {}
          {!isQuarantine && (
            <table className="qi-table">
              <thead>
                <tr>
                  <th>ISOLATION ID</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("batchId")}>BATCH ID{sortIndicator("batchId", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("dateIsolated")}>DATE ISOLATED{sortIndicator("dateIsolated", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("headCount")}>NUMBER OF BIRDS ISOLATED{sortIndicator("headCount", sortColumn, sortDirection)}</th>
                  <th>SYMPTOMS / REASONS</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("location")}>LOCATION{sortIndicator("location", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("recovered")}>RECOVERED{sortIndicator("recovered", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("deceased")}>DECEASED{sortIndicator("deceased", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("remaining")}>REMAINING{sortIndicator("remaining", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("dateCompleted")}>DATE COMPLETED{sortIndicator("dateCompleted", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("currentStatus")}>STATUS{sortIndicator("currentStatus", sortColumn, sortDirection)}</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="12" className="qi-empty-state">Loading isolation records...</td></tr>
                ) : filteredIsolation.length === 0 && isolationRecords.length > 0 ? (
                  <tr>
                    <td colSpan="12" className="qi-empty-state">
                      <div className="qi-empty-content">
                        <FiMaximize />
                        <h3>No quarantine and isolation records found</h3>
                        <p>No matching isolation records were found for your search.</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredIsolation.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="qi-empty-state">
                      <div className="qi-empty-content">
                        <FiMaximize />
                        <h3>No quarantine and isolation records found</h3>
                        <p>Click Add Isolation Record to log a symptomatic bird.</p>
                        <button className="qi-empty-add-btn" onClick={() => navigate(addRoute)}>
                          <FiPlus /> Add Isolation Record
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageIsolation.map((r) => (
                    <tr key={r._id}>
                      <td>{r.isolationId || "—"}</td>
                      <td><span className="qi-batch-badge">{r.batchId}</span></td>
                      <td>{r.dateIsolated}</td>
                      <td className="qi-center">{r.headCount}</td>
                      <td>{r.symptoms}</td>
                      <td>{r.location || "—"}</td>
                      <td className="qi-center">{r.recovered ?? 0}</td>
                      <td className="qi-center">{r.deceased ?? 0}</td>
                      <td className="qi-center">{r.remaining ?? 0}</td>
                      <td>{r.dateCompleted || "—"}</td>
                      <td>
                        <button
                          type="button"
                          className={`qi-status-trigger-btn ${statusClass(r.currentStatus)}`}
                          onClick={() => openProgressModal(r)}
                        >
                          {r.currentStatus} <FiChevronDown className="qi-status-chevron" />
                        </button>
                      </td>
                      <td>
                        <div className="qi-actions">
                          <button className="qi-btn-edit" title="View" onClick={() => setViewRecord(r)}>
                            <FiEye />
                          </button>
                          {canEdit && (
                          <button className="qi-btn-edit" title="Edit"
                            onClick={() => navigate(`/records/quarantine/edit/${r._id}?type=isolation`)}>
                            <FiEdit2 />
                          </button>
                          )}
                          {canArchive && (
                          <button className="qi-btn-archive" onClick={() => requestArchive({ module: "Quarantine & Isolation", moduleKey: "pb_isolation", record: r, name: r.cage || r.batchId })} title="Archive">
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

      <ArchiveConfirmModal pending={archivePending} onCancel={cancelArchive} onConfirm={confirmArchive} />

      {viewRecord && (
        <div className="pb-confirm-overlay" onClick={() => setViewRecord(null)}>
          <div className="pb-confirm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, textAlign: "left" }}>
            <h3 className="pb-confirm-title">Isolation Record — {viewRecord.isolationId}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", margin: "12px 0" }}>
              <div><small>Isolation ID</small><p style={{ margin: 0 }}>{viewRecord.isolationId}</p></div>
              <div><small>Batch ID</small><p style={{ margin: 0 }}>{viewRecord.batchId}</p></div>
              <div><small>Date Isolated</small><p style={{ margin: 0 }}>{viewRecord.dateIsolated}</p></div>
              <div><small>Number of Birds Isolated</small><p style={{ margin: 0 }}>{viewRecord.headCount}</p></div>
              <div style={{ gridColumn: "1 / -1" }}><small>Symptoms/Reasons</small><p style={{ margin: 0 }}>{viewRecord.symptoms}</p></div>
              <div style={{ gridColumn: "1 / -1" }}><small>Location</small><p style={{ margin: 0 }}>{viewRecord.location || "—"}</p></div>
              <div style={{ gridColumn: "1 / -1" }}><small>Remarks</small><p style={{ margin: 0 }}>{viewRecord.remarks || "—"}</p></div>
              <div><small>Recovered</small><p style={{ margin: 0 }}>{viewRecord.recovered ?? 0}</p></div>
              <div><small>Deceased</small><p style={{ margin: 0 }}>{viewRecord.deceased ?? 0}</p></div>
              <div><small>Remaining</small><p style={{ margin: 0 }}>{viewRecord.remaining ?? 0}</p></div>
              <div><small>Date Completed</small><p style={{ margin: 0 }}>{viewRecord.dateCompleted || "—"}</p></div>
              <div style={{ gridColumn: "1 / -1" }}><small>Status</small><p style={{ margin: 0 }}><span className={statusClass(viewRecord.currentStatus)}>{viewRecord.currentStatus}</span></p></div>
            </div>
            <div className="pb-confirm-actions">
              <button className="pb-confirm-cancel" onClick={() => setViewRecord(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {pendingRelease && (
        <div className="pb-confirm-overlay" onClick={() => !releaseSaving && setPendingRelease(null)}>
          <div className="pb-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="pb-confirm-title">Confirm Quarantine Release</h3>
            <p className="pb-confirm-message">
              Are you sure you want to release Batch {pendingRelease.batchId} from quarantine?
              This will automatically set its Flock Profile status to Active.
            </p>
            <div className="pb-confirm-actions">
              <button className="pb-confirm-cancel" onClick={() => setPendingRelease(null)} disabled={releaseSaving}>
                Cancel
              </button>
              <button className="pb-confirm-archive" onClick={confirmRelease} disabled={releaseSaving}>
                {releaseSaving ? "Releasing..." : "Confirm & Release"}
              </button>
            </div>
          </div>
        </div>
      )}

      {progressRecord && (
        <div className="pb-confirm-overlay" onClick={closeProgressModal}>
          <div className="pb-confirm-modal qi-progress-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="pb-confirm-title">Update Isolation Status</h3>

            {progError && <div className="pb-error-banner">{progError}</div>}

            {!progConfirming && (
              <>
                <div className="qi-progress-columns">
                  <div className="qi-progress-col">
                    <h4 className="qi-progress-col-title">Isolation Information</h4>
                    <div className="qi-progress-kv"><small>Isolation ID</small><p>{progressRecord.isolationId}</p></div>
                    <div className="qi-progress-kv"><small>Batch ID</small><p>{progressRecord.batchId}</p></div>
                    <div className="qi-progress-kv"><small>Number of Birds Isolated</small><p>{progressRecord.headCount}</p></div>
                    <div className="qi-progress-kv"><small>Status</small><p><span className={statusClass(progressRecord.currentStatus)}>{progressRecord.currentStatus}</span></p></div>
                  </div>

                  <div className="qi-progress-col">
                    <h4 className="qi-progress-col-title">Current Progress</h4>
                    <div className="qi-progress-kv"><small>Recovered</small><p className="qi-progress-strong">{progressRecord.recovered}</p></div>
                    <div className="qi-progress-kv"><small>Deceased</small><p className="qi-progress-strong">{progressRecord.deceased}</p></div>
                    <div className="qi-progress-kv"><small>Remaining</small><p className="qi-progress-strong">{progressRecord.remaining}</p></div>
                  </div>

                  <div className="qi-progress-col">
                    {progressMode === "view" && (
                      <>
                        <h4 className="qi-progress-col-title">Add New Progress</h4>
                        {progressRecord.remaining > 0 ? (
                          <button type="button" className="pb-confirm-archive qi-progress-add-btn" onClick={startAddUpdate}>
                            <FiPlus /> Add New Update
                          </button>
                        ) : (
                          <p className="qi-progress-note">This isolation event is complete — no further updates needed.</p>
                        )}
                      </>
                    )}

                    {(progressMode === "add" || progressMode === "correct") && (
                      <>
                        <h4 className="qi-progress-col-title">
                          {progressMode === "add" ? "Add New Progress" : "Correct This Update"}
                        </h4>
                        <div className="qi-progress-field">
                          <label>Date</label>
                          <input type="date" max={today} value={progForm.date}
                            onChange={(e) => setProgForm((p) => ({ ...p, date: e.target.value }))} />
                        </div>
                        <div className="qi-progress-field">
                          <label>Recovered</label>
                          <input type="text" inputMode="numeric" value={progForm.recovered}
                            onChange={(e) => setProgForm((p) => ({ ...p, recovered: e.target.value.replace(/[^\d]/g, "") }))}
                            placeholder="0" />
                        </div>
                        <div className="qi-progress-field">
                          <label>Deceased</label>
                          <input type="text" inputMode="numeric" value={progForm.deceased}
                            onChange={(e) => setProgForm((p) => ({ ...p, deceased: e.target.value.replace(/[^\d]/g, "") }))}
                            placeholder="0" />
                        </div>
                        <div className="qi-progress-inline-actions">
                          <button type="button" className="pb-confirm-cancel" onClick={cancelProgAction}>Cancel</button>
                          <button type="button" className="pb-confirm-archive" onClick={requestProgConfirm}>Save Update</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="qi-progress-history">
                  <h4 className="qi-progress-col-title">Previous Progress History</h4>
                  {progressRecord.progressUpdates?.length > 0 ? (
                    <div className="qi-progress-history-scroll">
                      <table className="qi-progress-history-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Recovered</th>
                            <th>Deceased</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {progressRecord.progressUpdates.map((u) => (
                            <tr key={u._id}>
                              <td>{u.date}</td>
                              <td>{u.recoveredDelta}</td>
                              <td>{u.deceasedDelta}</td>
                              <td>
                                {progressMode !== "correct" && (
                                  <button type="button" className="qi-progress-edit-btn" title="Correct this update"
                                    onClick={() => startCorrectEntry(u)}>
                                    <FiEdit2 />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="qi-progress-note">No progress updates yet.</p>
                  )}
                </div>

                <div className="pb-confirm-actions qi-progress-footer">
                  <button className="pb-confirm-cancel" onClick={closeProgressModal}>Close</button>
                </div>
              </>
            )}

            {progConfirming && (
              <>
                <p className="pb-confirm-message">
                  {progressMode === "add" ? "Are you sure you want to save this update?" : "Are you sure you want to save this correction?"}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", margin: "12px 0" }}>
                  <div><small>Recovered</small><p style={{ margin: 0, fontWeight: 700 }}>{progForm.recovered || 0}</p></div>
                  <div><small>Deceased</small><p style={{ margin: 0, fontWeight: 700 }}>{progForm.deceased || 0}</p></div>
                </div>
                <div className="pb-confirm-actions">
                  <button className="pb-confirm-cancel" onClick={() => setProgConfirming(false)} disabled={progSaving}>
                    Cancel
                  </button>
                  <button className="pb-confirm-archive" onClick={confirmProgSave} disabled={progSaving}>
                    {progSaving ? "Saving..." : "Confirm & Save"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  );
}