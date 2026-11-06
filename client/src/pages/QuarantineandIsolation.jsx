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
import { listQuarantineRecords, updateIsolationProgress, correctIsolationProgress } from "../api/quarantineIsolation";
import { getFarmInfo } from "../api/profile";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination, { TableSection, TableScroll } from "../components/TablePagination";
import { useLanguage } from "../i18n/LanguageContext";

export default function QuarantineIsolation() {
  const { t: tr } = useLanguage();
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
      setError(tr(err?.message || "Couldn't load quarantine & isolation records."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    getFarmInfo().then((d) => setFarmInfo(d)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (draft.dateFrom && draft.dateFrom > today) { setError(tr("Start date cannot be a future date.")); return; }
      if (draft.dateTo && draft.dateTo > today) { setError(tr("End date cannot be a future date.")); return; }
      if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) { setError(tr("Start date cannot be later than end date.")); return; }
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
              <FiPlus /> {tr(addLabel)}
            </button>
          )}
          <div className="qi-toolbar-right">
            <div className="qi-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder={tr("Search...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="qi-btn-group">
              <div className="qi-filter-wrap" ref={filterRef}>
                <button className="qi-toolbar-btn" onClick={openFilterPanel}>
                  <FiFilter />{" "}{tr("Filter")}{activeFilterCount > 0 && <span className="qi-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="qi-filter-dropdown">
                    <div className="qi-filter-dropdown-header">
                      <span>{tr("Filter")}{" "}{isQuarantine ? "Quarantine" : "Isolation"}{" "}{tr("Records")}</span>
                    </div>

                    <div className="qi-filter-section-label">{tr("Date Filter")}</div>
                    <div className="qi-filter-row">
                      <div className="qi-filter-group">
                        <label className="qi-filter-label">{tr("Date Period")}</label>
                        <select
                          className="qi-filter-select"
                          value={draft.period}
                          onChange={(e) => handleFilterChange("period", e.target.value)}
                        >
                          <option value="all">{tr("All Records")}</option>
                          <option value="today">{tr("Today")}</option>
                          <option value="week">{tr("Week")}</option>
                          <option value="month">{tr("Month")}</option>
                          <option value="year">{tr("Year")}</option>
                          <option value="custom">{tr("Custom Range")}</option>
                        </select>
                      </div>

                      {draft.period === "week" && (
                        <div className="qi-filter-group">
                          <label className="qi-filter-label">{tr("Week")}</label>
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
                          <label className="qi-filter-label">{tr("Month")}</label>
                          <select
                            className="qi-filter-select"
                            value={draft.month}
                            onChange={(e) => handleFilterChange("month", e.target.value)}
                          >
                            <option value="All">{tr("Select Month")}</option>
                            {monthOptions.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {(draft.period === "month" || draft.period === "year") && (
                        <div className="qi-filter-group">
                          <label className="qi-filter-label">{tr("Year")}</label>
                          <select
                            className="qi-filter-select"
                            value={draft.year}
                            onChange={(e) => handleFilterChange("year", e.target.value)}
                          >
                            <option value="All">{tr("Select Year")}</option>
                            {yearOptions.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {draft.period === "custom" && (
                      <div className="qi-filter-group">
                        <label className="qi-filter-label">{tr("Start Date / End Date")}</label>
                        <div className="qi-filter-date-range">
                          <input type="date" className="qi-filter-select" value={draft.dateFrom}
                            max={draft.dateTo || todayStr()}
                            onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label={tr("From date")} />
                          <span>{tr("to")}</span>
                          <input type="date" className="qi-filter-select" value={draft.dateTo}
                            min={draft.dateFrom || undefined} max={todayStr()}
                            onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label={tr("To date")} />
                        </div>
                      </div>
                    )}

                    <div className="qi-filter-section-label">{tr("Filters")}</div>
                    <div className="qi-filter-group">
                      <label className="qi-filter-label">{tr("Batch ID")}</label>
                      <select
                        className="qi-filter-select"
                        value={draft.batchId}
                        onChange={(e) => handleFilterChange("batchId", e.target.value)}
                      >
                        <option value="All">{tr("All Batches")}</option>
                        {batchOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div className="qi-filter-actions">
                      <button className="qi-filter-clear" onClick={clearFilters}>{tr("Clear All")}</button>
                      <button className="qi-filter-apply" onClick={applyFilters}>{tr("Apply")}</button>
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
                pdfExtra={{ period: farmMeta.period, summary: exportSummary, hideApprovalAndTagline: true }}
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
                <div><h3>{qTotal}</h3><p>{tr("Total Quarantine")}</p><span>{tr(statCardSpanLabel)}</span></div>
              </div>
              <div className="qi-stat-card">
                <div className="qi-stat-icon blue"><FiShield /></div>
                <div><h3>{qOngoing}</h3><p>{tr("Ongoing")}</p><span>{tr(statCardSpanLabel)}</span></div>
              </div>
              <div className="qi-stat-card">
                <div className="qi-stat-icon green"><FiCheckCircle /></div>
                <div><h3>{qReleased}</h3><p>{tr("Cleared / Released")}</p><span>{tr(statCardSpanLabel)}</span></div>
              </div>
              <div className="qi-stat-card">
                <div className="qi-stat-icon gold"><FiClipboard /></div>
                <div><h3>{qHeads}</h3><p>{tr("Total Head Count")}</p><span>{tr(statCardSpanLabel)}</span></div>
              </div>
            </>
          ) : (
            <>
              <div className="qi-stat-card">
                <div className="qi-stat-icon gold"><FiClipboard /></div>
                <div><h3>{iTotal}</h3><p>{tr("Total Isolation")}</p><span>{tr(statCardSpanLabel)}</span></div>
              </div>
              <div className="qi-stat-card">
                <div className="qi-stat-icon blue"><FiAlertCircle /></div>
                <div><h3>{iIsolation}</h3><p>{tr("In Isolation")}</p><span>{tr(statCardSpanLabel)}</span></div>
              </div>
              <div className="qi-stat-card">
                <div className="qi-stat-icon green"><FiCheckCircle /></div>
                <div><h3>{iRecovered}</h3><p>{tr("Recovered")}</p><span>{tr(statCardSpanLabel)}</span></div>
              </div>
              <div className="qi-stat-card">
                <div className="qi-stat-icon red"><FiHeart /></div>
                <div><h3>{iDeceased}</h3><p>{tr("Deceased")}</p><span>{tr(statCardSpanLabel)}</span></div>
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
            <FiShield />{" "}{tr("Quarantine Record")}</button>
          <button
            className={`qi-tab ${!isQuarantine ? "active" : ""}`}
            onClick={() => handleTabChange("isolation")}
          >
            <FiAlertCircle />{" "}{tr("Isolation Record")}</button>
        </div>

        {}
        <TableSection className="qi-table-wrapper">
          <TableScroll>

          {}
          {isQuarantine && (
            <table className="qi-table">
              <thead>
                <tr>
                  <th className="qi-sortable-th" onClick={() => cycleSort("batchId")}>{tr("BATCH ID")}{sortIndicator("batchId", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("breed")}>{tr("BREED")}{sortIndicator("breed", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("source")}>{tr("SUPPLIER")}{sortIndicator("source", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("dateAcquired")}>{tr("DATE ACQUIRED")}{sortIndicator("dateAcquired", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("headCount")}>{tr("HEAD COUNT")}{sortIndicator("headCount", sortColumn, sortDirection)}</th>
                  <th>{tr("VITAMINS GIVEN")}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("releasedDate")}>{tr("DATE RELEASED")}{sortIndicator("releasedDate", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("status")}>{tr("STATUS")}{sortIndicator("status", sortColumn, sortDirection)}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="qi-empty-state">{tr("Loading quarantine records...")}</td></tr>
                ) : filteredQuarantine.length === 0 && quarantineRecords.length > 0 ? (
                  <tr>
                    <td colSpan="8" className="qi-empty-state">
                      <div className="qi-empty-content">
                        <FiMaximize />
                        <h3>{tr("No quarantine and isolation records found")}</h3>
                        <p>{tr("No matching quarantine records were found for your search.")}</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredQuarantine.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="qi-empty-state">
                      <div className="qi-empty-content">
                        <FiMaximize />
                        <h3>{tr("No quarantine and isolation records found")}</h3>
                        <p>{tr("Quarantine records are created automatically when a new flock's age requires quarantine.")}</p>
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
                        <span className={statusClass(r.status)}>{r.status || "—"}</span>
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
                  <th>{tr("ISOLATION ID")}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("batchId")}>{tr("BATCH ID")}{sortIndicator("batchId", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("dateIsolated")}>{tr("DATE ISOLATED")}{sortIndicator("dateIsolated", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("headCount")}>{tr("NUMBER OF BIRDS ISOLATED")}{sortIndicator("headCount", sortColumn, sortDirection)}</th>
                  <th>{tr("SYMPTOMS / REASONS")}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("location")}>{tr("LOCATION")}{sortIndicator("location", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("recovered")}>{tr("RECOVERED")}{sortIndicator("recovered", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("deceased")}>{tr("DECEASED")}{sortIndicator("deceased", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("remaining")}>{tr("REMAINING")}{sortIndicator("remaining", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("dateCompleted")}>{tr("DATE COMPLETED")}{sortIndicator("dateCompleted", sortColumn, sortDirection)}</th>
                  <th className="qi-sortable-th" onClick={() => cycleSort("currentStatus")}>{tr("STATUS")}{sortIndicator("currentStatus", sortColumn, sortDirection)}</th>
                  <th>{tr("ACTIONS")}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="12" className="qi-empty-state">{tr("Loading isolation records...")}</td></tr>
                ) : filteredIsolation.length === 0 && isolationRecords.length > 0 ? (
                  <tr>
                    <td colSpan="12" className="qi-empty-state">
                      <div className="qi-empty-content">
                        <FiMaximize />
                        <h3>{tr("No quarantine and isolation records found")}</h3>
                        <p>{tr("No matching isolation records were found for your search.")}</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredIsolation.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="qi-empty-state">
                      <div className="qi-empty-content">
                        <FiMaximize />
                        <h3>{tr("No quarantine and isolation records found")}</h3>
                        <p>{tr("Click Add Isolation Record to log a symptomatic bird.")}</p>
                        <button className="qi-empty-add-btn" onClick={() => navigate(addRoute)}>
                          <FiPlus />{" "}{tr("Add Isolation Record")}</button>
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
                          {tr(r.currentStatus)} <FiChevronDown className="qi-status-chevron" />
                        </button>
                      </td>
                      <td>
                        <div className="qi-actions">
                          <button className="qi-btn-edit" title={tr("View")} onClick={() => setViewRecord(r)}>
                            <FiEye />
                          </button>
                          {canEdit && (
                          <button className="qi-btn-edit" title={tr("Edit")}
                            onClick={() => navigate(`/records/quarantine/edit/${r._id}?type=isolation`)}>
                            <FiEdit2 />
                          </button>
                          )}
                          {canArchive && (
                          <button className="qi-btn-archive" onClick={() => requestArchive({ module: "Quarantine & Isolation", moduleKey: "pb_isolation", record: r, name: r.cage || r.batchId })} title={tr("Archive")}>
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

      <ArchiveConfirmModal pending={archivePending} onCancel={cancelArchive} onConfirm={confirmArchive} />

      {viewRecord && (
        <div className="pb-confirm-overlay" onClick={() => setViewRecord(null)}>
          <div className="pb-confirm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, textAlign: "left" }}>
            <h3 className="pb-confirm-title">{tr("Isolation Record —")}{" "}{viewRecord.isolationId}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", margin: "12px 0" }}>
              <div><small>{tr("Isolation ID")}</small><p style={{ margin: 0 }}>{viewRecord.isolationId}</p></div>
              <div><small>{tr("Batch ID")}</small><p style={{ margin: 0 }}>{viewRecord.batchId}</p></div>
              <div><small>{tr("Date Isolated")}</small><p style={{ margin: 0 }}>{viewRecord.dateIsolated}</p></div>
              <div><small>{tr("Number of Birds Isolated")}</small><p style={{ margin: 0 }}>{viewRecord.headCount}</p></div>
              <div style={{ gridColumn: "1 / -1" }}><small>{tr("Symptoms/Reasons")}</small><p style={{ margin: 0 }}>{viewRecord.symptoms}</p></div>
              <div style={{ gridColumn: "1 / -1" }}><small>{tr("Location")}</small><p style={{ margin: 0 }}>{viewRecord.location || "—"}</p></div>
              <div style={{ gridColumn: "1 / -1" }}><small>{tr("Remarks")}</small><p style={{ margin: 0 }}>{viewRecord.remarks || "—"}</p></div>
              <div><small>{tr("Recovered")}</small><p style={{ margin: 0 }}>{viewRecord.recovered ?? 0}</p></div>
              <div><small>{tr("Deceased")}</small><p style={{ margin: 0 }}>{viewRecord.deceased ?? 0}</p></div>
              <div><small>{tr("Remaining")}</small><p style={{ margin: 0 }}>{viewRecord.remaining ?? 0}</p></div>
              <div><small>{tr("Date Completed")}</small><p style={{ margin: 0 }}>{viewRecord.dateCompleted || "—"}</p></div>
              <div style={{ gridColumn: "1 / -1" }}><small>{tr("Status")}</small><p style={{ margin: 0 }}><span className={statusClass(viewRecord.currentStatus)}>{tr(viewRecord.currentStatus)}</span></p></div>
            </div>
            <div className="pb-confirm-actions">
              <button className="pb-confirm-cancel" onClick={() => setViewRecord(null)}>{tr("Close")}</button>
            </div>
          </div>
        </div>
      )}

      {progressRecord && (
        <div className="pb-confirm-overlay" onClick={closeProgressModal}>
          <div className="pb-confirm-modal qi-progress-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="pb-confirm-title">{tr("Update Isolation Status")}</h3>

            {progError && <div className="pb-error-banner">{progError}</div>}

            {!progConfirming && (
              <>
                <div className="qi-progress-columns">
                  <div className="qi-progress-col">
                    <h4 className="qi-progress-col-title">{tr("Isolation Information")}</h4>
                    <div className="qi-progress-kv"><small>{tr("Isolation ID")}</small><p>{progressRecord.isolationId}</p></div>
                    <div className="qi-progress-kv"><small>{tr("Batch ID")}</small><p>{progressRecord.batchId}</p></div>
                    <div className="qi-progress-kv"><small>{tr("Number of Birds Isolated")}</small><p>{progressRecord.headCount}</p></div>
                    <div className="qi-progress-kv"><small>{tr("Status")}</small><p><span className={statusClass(progressRecord.currentStatus)}>{tr(progressRecord.currentStatus)}</span></p></div>
                  </div>

                  <div className="qi-progress-col">
                    <h4 className="qi-progress-col-title">{tr("Current Progress")}</h4>
                    <div className="qi-progress-kv"><small>{tr("Recovered")}</small><p className="qi-progress-strong">{progressRecord.recovered}</p></div>
                    <div className="qi-progress-kv"><small>{tr("Deceased")}</small><p className="qi-progress-strong">{progressRecord.deceased}</p></div>
                    <div className="qi-progress-kv"><small>{tr("Remaining")}</small><p className="qi-progress-strong">{progressRecord.remaining}</p></div>
                  </div>

                  <div className="qi-progress-col">
                    {progressMode === "view" && (
                      <>
                        <h4 className="qi-progress-col-title">{tr("Add New Progress")}</h4>
                        {progressRecord.remaining > 0 ? (
                          <button type="button" className="pb-confirm-archive qi-progress-add-btn" onClick={startAddUpdate}>
                            <FiPlus />{" "}{tr("Add New Update")}</button>
                        ) : (
                          <p className="qi-progress-note">{tr("This isolation event is complete — no further updates needed.")}</p>
                        )}
                      </>
                    )}

                    {(progressMode === "add" || progressMode === "correct") && (
                      <>
                        <h4 className="qi-progress-col-title">
                          {progressMode === "add" ? "Add New Progress" : "Correct This Update"}
                        </h4>
                        <div className="qi-progress-field">
                          <label>{tr("Date")}</label>
                          <input type="date" max={today} value={progForm.date}
                            onChange={(e) => {
                              const blocked = e.target.value > today;
                              setProgForm((p) => ({ ...p, date: blocked ? today : e.target.value }));
                              setProgError(blocked ? "Date cannot be a future date." : "");
                            }} />
                        </div>
                        <div className="qi-progress-field">
                          <label>{tr("Recovered")}</label>
                          <input type="text" inputMode="numeric" value={progForm.recovered}
                            onChange={(e) => setProgForm((p) => ({ ...p, recovered: e.target.value.replace(/[^\d]/g, "") }))}
                            placeholder="0" />
                        </div>
                        <div className="qi-progress-field">
                          <label>{tr("Deceased")}</label>
                          <input type="text" inputMode="numeric" value={progForm.deceased}
                            onChange={(e) => setProgForm((p) => ({ ...p, deceased: e.target.value.replace(/[^\d]/g, "") }))}
                            placeholder="0" />
                        </div>
                        <div className="qi-progress-inline-actions">
                          <button type="button" className="pb-confirm-cancel" onClick={cancelProgAction}>{tr("Cancel")}</button>
                          <button type="button" className="pb-confirm-archive" onClick={requestProgConfirm}>{tr("Save Update")}</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="qi-progress-history">
                  <h4 className="qi-progress-col-title">{tr("Previous Progress History")}</h4>
                  {progressRecord.progressUpdates?.length > 0 ? (
                    <div className="qi-progress-history-scroll">
                      <table className="qi-progress-history-table">
                        <thead>
                          <tr>
                            <th>{tr("Date")}</th>
                            <th>{tr("Recovered")}</th>
                            <th>{tr("Deceased")}</th>
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
                                  <button type="button" className="qi-progress-edit-btn" title={tr("Correct this update")}
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
                    <p className="qi-progress-note">{tr("No progress updates yet.")}</p>
                  )}
                </div>

                <div className="pb-confirm-actions qi-progress-footer">
                  <button className="pb-confirm-cancel" onClick={closeProgressModal}>{tr("Close")}</button>
                </div>
              </>
            )}

            {progConfirming && (
              <>
                <p className="pb-confirm-message">
                  {progressMode === "add" ? "Are you sure you want to save this update?" : "Are you sure you want to save this correction?"}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", margin: "12px 0" }}>
                  <div><small>{tr("Recovered")}</small><p style={{ margin: 0, fontWeight: 700 }}>{progForm.recovered || 0}</p></div>
                  <div><small>{tr("Deceased")}</small><p style={{ margin: 0, fontWeight: 700 }}>{progForm.deceased || 0}</p></div>
                </div>
                <div className="pb-confirm-actions">
                  <button className="pb-confirm-cancel" onClick={() => setProgConfirming(false)} disabled={progSaving}>{tr("Cancel")}</button>
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