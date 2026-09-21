import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter,
  FiEdit2, FiArchive, FiMaximize,
  FiActivity, FiClipboard, FiDroplet,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { useUser } from "../hooks/useUser";
import ExportMenu from "../components/ExportMenu";
import { getFarmInfo } from "../api/profile";
import "./HealthRecord.css";
import { useArchiveConfirm } from "../hooks/useArchiveConfirm";
import ArchiveConfirmModal from "../components/ArchiveConfirmModal";
import { listHealthRecords } from "../api/healthRecord";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination from "../components/TablePagination";
import "../components/TablePagination.css";

export default function HealthRecord() {
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
    params.get("tab") === "vaccination" ? "vaccination" : "diagnosis"
  );
  const [farmInfo, setFarmInfo] = useState({ farmName: "", farmLocation: "", farmContact: "", farmEmail: "", farmLogo: "" });
  const [viewRecord, setViewRecord] = useState(null);

  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    listHealthRecords()
      .then((d) => {
        const list = Array.isArray(d) ? d : d.records || d.data || [];
        setAllRecords(list.map((r) => ({ ...r, date: r.date ? String(r.date).slice(0, 10) : r.date })));
      })
      .catch((err) => { setAllRecords([]); setError(err?.message || "Couldn't load health records."); })
      .finally(() => setLoading(false));
    getFarmInfo().then((d) => setFarmInfo(d)).catch(() => {});
  }, []);

  const isVaxRec = (r) =>
    ["Vaccination", "Medication", "Vitamin Administration"].includes(r.recordType);
  const diagnosisRecords = allRecords.filter((r) => !isVaxRec(r));
  const vaccinationRecords = allRecords.filter(isVaxRec);
  const diagnosisCodeById = Object.fromEntries(
    diagnosisRecords.filter((d) => d.diagnosisCode).map((d) => [d._id, d.diagnosisCode])
  );

  useEffect(() => {
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const isDiagnosis = activeTab === "diagnosis";

  const handleFilterChange = (key, value) => setDraft((f) => ({ ...f, [key]: value }));
  const clearFilters = () => { setDraft(defaultFilters); setFilters(defaultFilters); setFilterApplied(false); };
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
    clearFilters();
    setShowFilter(false);
  };

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

  const matchesDatePeriod = (r, f) => {
    if (f.period === "all") return true;
    const d = new Date(r.date);
    const recYear = isNaN(d) ? null : String(d.getFullYear());
    const recMonth = isNaN(d) ? null : MONTH_NAMES[d.getMonth()];
    if (f.period === "today") return r.date === todayStr();
    if (f.period === "week") return !!f.week && isoWeekOf(r.date) === f.week;
    if (f.period === "month") return f.year !== "All" && f.month !== "All" && recYear === f.year && recMonth === f.month;
    if (f.period === "year") return f.year !== "All" && recYear === f.year;
    if (f.period === "custom") return (!f.dateFrom || r.date >= f.dateFrom) && (!f.dateTo || r.date <= f.dateTo);
    return true;
  };

  const matchFilters = (r, f) => {
    const matchBatch = f.batchId === "All" || r.batchId === f.batchId;
    return matchBatch && matchesDatePeriod(r, f);
  };

  const filteredDiagnosis = diagnosisRecords.filter((r) =>
    r.batchId?.toLowerCase().includes(search.toLowerCase()) && (!filterApplied || matchFilters(r, filters))
  );

  const filteredVaccination = vaccinationRecords.filter((r) =>
    r.batchId?.toLowerCase().includes(search.toLowerCase()) && (!filterApplied || matchFilters(r, filters))
  );

  const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
  const diagnosisAccessor = (row, col) => {
    if (col === "date") return row.date || "";
    if (col === "batchId") return row.batchId || "";
    if (col === "birdsAffected") return Number(row.numberOfBirdsAffected) || 0;
    if (col === "mortality") return Number(row.numberMortality) || 0;
    if (col === "nextSchedule") return row.nextSchedule || "";
    return "";
  };
  const vaccinationAccessor = (row, col) => {
    if (col === "date") return row.date || "";
    if (col === "batchId") return row.batchId || "";
    if (col === "birdsAdministered") return Number(row.numberOfBirdsAdministered ?? row.numberOfBirds) || 0;
    if (col === "vaccineOrDrug") return row.vaccineOrDrug || "";
    if (col === "administeredBy") return row.administeredBy || "";
    if (col === "nextSchedule") return row.nextSchedule || "";
    return "";
  };
  const sortedDiagnosis = sortData(filteredDiagnosis, diagnosisAccessor);
  const sortedVaccination = sortData(filteredVaccination, vaccinationAccessor);
  const activeSorted = isDiagnosis ? sortedDiagnosis : sortedVaccination;
  const pager = usePagination(activeSorted.length);
  useEffect(() => { pager.setPage(1); }, [search, filterApplied, filters, activeTab]);
  const pageDiagnosis = sortedDiagnosis.slice(pager.startIndex, pager.endIndex);
  const pageVaccination = sortedVaccination.slice(pager.startIndex, pager.endIndex);

  const activeSource = isDiagnosis ? diagnosisRecords : vaccinationRecords;
  const uniq = (vals) => [...new Set(vals.filter(Boolean))];
  const batchOptions = uniq(activeSource.map((r) => r.batchId));

  const yearOptions = uniq(
    activeSource.map((r) => { const d = new Date(r.date); return isNaN(d) ? null : String(d.getFullYear()); })
  ).sort((a, b) => b - a);

  const monthOptions = uniq(
    activeSource
      .filter((r) => draft.year === "All" || String(new Date(r.date).getFullYear()) === draft.year)
      .map((r) => { const d = new Date(r.date); return isNaN(d) ? null : MONTH_NAMES[d.getMonth()]; })
  ).sort((a, b) => MONTH_NAMES.indexOf(a) - MONTH_NAMES.indexOf(b));

  const liveStats = {
    totalDiagnosis: filteredDiagnosis.length,
    totalVaccinations: filteredVaccination.length,
  };

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
    fields: filters.batchId !== "All" ? [{ label: "Batch ID", value: filters.batchId }] : [{ label: "Batch", value: "All Batches" }],
  };

  const exportTitle = isDiagnosis ? "Disease Monitoring Report" : "Vaccination Report";
  const diagnosisReportColumns = [
    { key: "diagnosisCode", label: "Diagnosis ID" },
    { key: "isolationId", label: "Isolation ID" },
    { key: "date", label: "Date" },
    { key: "batchId", label: "Batch ID" },
    { key: "age", label: "Age" },
    { key: "birdsAffected", label: "No. of Birds Affected" },
    { key: "symptoms", label: "Observation" },
    { key: "presumptiveDiagnosis", label: "Presumptive Diagnosis" },
    { key: "vetDiagnosis", label: "Vet Diagnosis" },
    { key: "treatment", label: "Treatment Applied" },
    { key: "mortality", label: "Number Mortality" },
    { key: "nextSchedule", label: "Schedule" },
    { key: "remarks", label: "Remarks" },
  ];
  const vaccinationReportColumns = [
    { key: "medicationCode", label: "Medication ID" },
    { key: "date", label: "Date" },
    { key: "batchId", label: "Batch ID" },
    { key: "diagnosisCode", label: "Diagnosis ID" },
    { key: "birdsAdministered", label: "No. of Birds Administered" },
    { key: "vaccineOrDrug", label: "Vaccine / Drug" },
    { key: "targetAge", label: "Age" },
    { key: "route", label: "Route" },
    { key: "dosage", label: "Dosage & Frequency" },
    { key: "administeredBy", label: "Administered By" },
    { key: "nextSchedule", label: "Schedule" },
    { key: "remarks", label: "Remarks" },
  ];
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-CA") : "—");
  const renderRemarksCell = (record, text) => {
    if (!text) return "—";
    if (text.length <= 15) return text;
    return (
      <button type="button" className="hr-view-remarks-link" onClick={() => setViewRecord(record)}>
        View Remarks
      </button>
    );
  };
  const diagnosisReportRows = filteredDiagnosis.map((r) => ({
    date: fmtDate(r.date),
    diagnosisCode: r.diagnosisCode || "—",
    isolationId: r.isolationId?.isolationId || "—",
    batchId: r.batchId || "—",
    age: r.targetAge || "—",
    birdsAffected: r.numberOfBirdsAffected ?? "—",
    symptoms: r.symptomsObserved || "—",
    presumptiveDiagnosis: r.presumptiveDiagnosis || "—",
    vetDiagnosis: r.vetDiagnosis || "—",
    treatment: r.treatmentApplied || "—",
    mortality: r.numberMortality ?? "—",
    nextSchedule: fmtDate(r.nextSchedule),
    remarks: r.remarks || "—",
  }));
  const vaccinationReportRows = filteredVaccination.map((r) => ({
    medicationCode: r.medicationCode || "—",
    date: fmtDate(r.date),
    batchId: r.batchId || "—",
    diagnosisCode: diagnosisCodeById[r.diagnosisId] || "—",
    birdsAdministered: r.numberOfBirdsAdministered ?? r.numberOfBirds ?? "—",
    vaccineOrDrug: r.vaccineOrDrug || "—",
    targetAge: r.targetAge || "—",
    route: r.routeOfAdmin || "—",
    dosage: [r.dosage && r.dosageUnit ? `${r.dosage} ${r.dosageUnit}` : r.dosage, r.frequency].filter(Boolean).join(" — ") || "—",
    administeredBy: r.administeredBy || "—",
    nextSchedule: fmtDate(r.nextSchedule),
    remarks: r.remarks || "—",
  }));
  const exportRows = isDiagnosis ? diagnosisReportRows : vaccinationReportRows;
  const exportColumns = isDiagnosis ? diagnosisReportColumns : vaccinationReportColumns;
  const exportSummary = isDiagnosis
    ? [{ label: "Total Diagnosis Records", value: String(liveStats.totalDiagnosis) }]
    : [{ label: "Total Vaccinations", value: String(liveStats.totalVaccinations) }];

  const addLabel = "Add Medication/Vaccination Record";
  const addPath = "/records/health/add";

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "RECORDS", path: "/records" },
        { label: "HEALTH RECORD" },
      ]}
    >

        {}
        <div className="hr-toolbar">
          {!isDiagnosis && (
            <button className="hr-add-btn" onClick={() => navigate(addPath)}>
              <FiPlus /> {addLabel}
            </button>
          )}
          <div className="hr-toolbar-right">
            <div className="hr-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="hr-btn-group">
              <div className="hr-filter-wrap" ref={filterRef}>
                <button className="hr-toolbar-btn" onClick={openFilterPanel}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="hr-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="hr-filter-dropdown">
                    <div className="hr-filter-dropdown-header">
                      <span>Filter {isDiagnosis ? "Diagnosis" : "Vaccination"} Records</span>
                    </div>

                    <div className="hr-filter-section-label">Date Filter</div>
                    <div className="hr-filter-row">
                      <div className="hr-filter-group">
                        <label className="hr-filter-label">Date Period</label>
                        <select
                          className="hr-filter-select"
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
                        <div className="hr-filter-group">
                          <label className="hr-filter-label">Week</label>
                          <input
                            type="week"
                            className="hr-filter-select"
                            value={draft.week}
                            onChange={(e) => handleFilterChange("week", e.target.value)}
                          />
                        </div>
                      )}

                      {draft.period === "month" && (
                        <div className="hr-filter-group">
                          <label className="hr-filter-label">Month</label>
                          <select
                            className="hr-filter-select"
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
                        <div className="hr-filter-group">
                          <label className="hr-filter-label">Year</label>
                          <select
                            className="hr-filter-select"
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
                      <div className="hr-filter-group">
                        <label className="hr-filter-label">Start Date / End Date</label>
                        <div className="hr-filter-date-range">
                          <input type="date" className="hr-filter-select" value={draft.dateFrom}
                            max={draft.dateTo || todayStr()}
                            onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label="From date" />
                          <span>to</span>
                          <input type="date" className="hr-filter-select" value={draft.dateTo}
                            min={draft.dateFrom || undefined} max={todayStr()}
                            onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label="To date" />
                        </div>
                      </div>
                    )}

                    <div className="hr-filter-section-label">Filters</div>
                    <div className="hr-filter-group">
                      <label className="hr-filter-label">Batch ID</label>
                      <select
                        className="hr-filter-select"
                        value={draft.batchId}
                        onChange={(e) => handleFilterChange("batchId", e.target.value)}
                      >
                        <option value="All">All Batches</option>
                        {batchOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-filter-actions">
                      <button className="hr-filter-clear" onClick={clearFilters}>Clear All</button>
                      <button className="hr-filter-apply" onClick={applyFilters}>Apply</button>
                    </div>
                  </div>
                )}
              </div>

              <ExportMenu
                rows={exportRows}
                columns={exportColumns}
                name={isDiagnosis ? "disease-record" : "vaccination-record"}
                title={exportTitle}
                meta={farmMeta}
                pdfExtra={{ period: farmMeta.period, summary: exportSummary, hideApprovalAndTagline: true }}
                moduleLabel={isDiagnosis ? "Health Record — Disease" : "Health Record — Vaccination"}
                enablePreview
                filters={{
                  ...(filters.batchId !== "All" ? { "Batch ID": filters.batchId } : {}),
                  ...(filterApplied && filters.period !== "all" ? { "Report Period": periodLabel } : {}),
                }}
                className="hr-toolbar-btn"
              />
            </div>
          </div>
        </div>

        {error && <div className="hr-active-filters" style={{ color: "#d94f4f" }}>{error}</div>}

        {}
        <div className="hr-stats-grid">
          <div className="hr-stat-card">
            <div className="hr-stat-icon gold"><FiClipboard /></div>
            <div>
              <h3>{liveStats.totalDiagnosis}</h3>
              <p>Total Diagnosis Records</p>
              <span>{statCardSpanLabel}</span>
            </div>
          </div>
          <div className="hr-stat-card">
            <div className="hr-stat-icon green"><FiActivity /></div>
            <div>
              <h3>{liveStats.totalVaccinations}</h3>
              <p>Total Vaccinations</p>
              <span>{statCardSpanLabel}</span>
            </div>
          </div>
        </div>

        {}
        <div className="hr-tabs">
          <button
            className={`hr-tab ${activeTab === "diagnosis" ? "active" : ""}`}
            onClick={() => handleTabChange("diagnosis")}
          >
            <FiActivity /> Diagnosis Record
          </button>
          <button
            className={`hr-tab ${activeTab === "vaccination" ? "active" : ""}`}
            onClick={() => handleTabChange("vaccination")}
          >
            <FiDroplet /> Medication / Vaccination Record
          </button>
        </div>

        {}
        <div className="hr-table-wrapper">

          {activeTab === "diagnosis" && (
            <table className="hr-table">
              <thead>
                <tr>
                  <th>DIAGNOSIS ID</th>
                  <th>ISOLATION ID</th>
                  <th className="hr-sortable-th" onClick={() => cycleSort("date")}>DATE{sortIndicator("date", sortColumn, sortDirection)}</th>
                  <th className="hr-sortable-th" onClick={() => cycleSort("batchId")}>BATCH ID{sortIndicator("batchId", sortColumn, sortDirection)}</th>
                  <th>AGE</th>
                  <th className="hr-sortable-th" onClick={() => cycleSort("birdsAffected")}>NUMBER OF BIRDS AFFECTED{sortIndicator("birdsAffected", sortColumn, sortDirection)}</th>
                  <th>OBSERVATION</th>
                  <th>PRESUMPTIVE DIAGNOSIS</th>
                  <th>VET DIAGNOSIS</th>
                  <th>TREATMENT APPLIED</th>
                  <th className="hr-sortable-th" onClick={() => cycleSort("mortality")}>NUMBER MORTALITY{sortIndicator("mortality", sortColumn, sortDirection)}</th>
                  <th className="hr-sortable-th" onClick={() => cycleSort("nextSchedule")}>SCHEDULE{sortIndicator("nextSchedule", sortColumn, sortDirection)}</th>
                  <th>REMARKS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="14" className="hr-empty-state">Loading health records...</td></tr>
                ) : filteredDiagnosis.length === 0 ? (
                  <tr>
                    <td colSpan="14" className="hr-empty-state">
                      <div className="hr-empty-content">
                        <FiMaximize />
                        <h3>No diagnosis records found</h3>
                        <p>Diagnosis records are created automatically when an Isolation Record is added.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageDiagnosis.map((r) => (
                    <tr key={r._id}>
                      <td><span className="hr-diagnosis-badge">{r.diagnosisCode || "—"}</span></td>
                      <td><span className="hr-isolation-badge">{r.isolationId?.isolationId || "—"}</span></td>
                      <td>{new Date(r.date).toLocaleDateString("en-CA")}</td>
                      <td><span className="hr-batch-badge">{r.batchId}</span></td>
                      <td>{r.targetAge || "—"}</td>
                      <td className="hr-center">{r.numberOfBirdsAffected ?? "—"}</td>
                      <td>{r.symptomsObserved || "—"}</td>
                      <td>{r.presumptiveDiagnosis || "—"}</td>
                      <td>{r.vetDiagnosis}</td>
                      <td>{r.treatmentApplied}</td>
                      <td className="hr-center">{r.numberMortality}</td>
                      <td>{r.nextSchedule ? String(r.nextSchedule).slice(0, 10) : "—"}</td>
                      <td>{renderRemarksCell(r, r.remarks)}</td>
                      <td>
                        <div className="hr-actions">
                          {canEdit && (
                          <button
                            className="hr-btn-edit"
                            title="Edit"
                            onClick={() => navigate(`/records/health/edit/${r._id}?type=diagnosis`)}
                          >
                            <FiEdit2 />
                          </button>
                          )}
                          {canArchive && (
                          <button className="hr-btn-archive" onClick={() => requestArchive({ module: "Health Records", moduleKey: "pb_health", record: r, name: r.batchId || r.cage || r.diagnosis })} title="Archive">
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

          {activeTab === "vaccination" && (
            <table className="hr-table">
              <thead>
                <tr>
                  <th>MEDICATION ID</th>
                  <th className="hr-sortable-th" onClick={() => cycleSort("date")}>DATE{sortIndicator("date", sortColumn, sortDirection)}</th>
                  <th className="hr-sortable-th" onClick={() => cycleSort("batchId")}>BATCH ID{sortIndicator("batchId", sortColumn, sortDirection)}</th>
                  <th>DIAGNOSIS ID</th>
                  <th className="hr-sortable-th" onClick={() => cycleSort("birdsAdministered")}>NO. OF BIRDS ADMINISTERED{sortIndicator("birdsAdministered", sortColumn, sortDirection)}</th>
                  <th className="hr-sortable-th" onClick={() => cycleSort("vaccineOrDrug")}>VACCINE / DRUG{sortIndicator("vaccineOrDrug", sortColumn, sortDirection)}</th>
                  <th>TARGET AGE / STAGE</th>
                  <th>ROUTE</th>
                  <th>DOSAGE & FREQUENCY</th>
                  <th className="hr-sortable-th" onClick={() => cycleSort("administeredBy")}>ADMINISTERED BY{sortIndicator("administeredBy", sortColumn, sortDirection)}</th>
                  <th className="hr-sortable-th" onClick={() => cycleSort("nextSchedule")}>SCHEDULE{sortIndicator("nextSchedule", sortColumn, sortDirection)}</th>
                  <th>REMARKS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="13" className="hr-empty-state">Loading health records...</td></tr>
                ) : filteredVaccination.length === 0 && vaccinationRecords.length > 0 ? (
                  <tr>
                    <td colSpan="13" className="hr-empty-state">
                      <div className="hr-empty-content">
                        <FiMaximize />
                        <h3>No medication/vaccination records found</h3>
                        <p>No matching medication/vaccination records were found for your search.</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredVaccination.length === 0 ? (
                  <tr>
                    <td colSpan="13" className="hr-empty-state">
                      <div className="hr-empty-content">
                        <FiMaximize />
                        <h3>No medication/vaccination records found</h3>
                        <p>Click Add Medication/Vaccination Record to log your first entry.</p>
                        <button className="hr-empty-add-btn" onClick={() => navigate("/records/health/add")}>
                          <FiPlus /> Add Medication/Vaccination Record
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageVaccination.map((r) => (
                    <tr key={r._id}>
                      <td><span className="hr-medication-badge">{r.medicationCode || "—"}</span></td>
                      <td>{new Date(r.date).toLocaleDateString("en-CA")}</td>
                      <td><span className="hr-batch-badge">{r.batchId}</span></td>
                      <td><span className="hr-diagnosis-badge">{diagnosisCodeById[r.diagnosisId] || "—"}</span></td>
                      <td className="hr-center">{r.numberOfBirdsAdministered ?? r.numberOfBirds ?? "—"}</td>
                      <td>{r.vaccineOrDrug}</td>
                      <td>{r.targetAge || "—"}</td>
                      <td>{r.routeOfAdmin}</td>
                      <td>{[r.dosage && r.dosageUnit ? `${r.dosage} ${r.dosageUnit}` : r.dosage, r.frequency].filter(Boolean).join(" — ") || "—"}</td>
                      <td>{r.administeredBy}</td>
                      <td>{r.nextSchedule ? String(r.nextSchedule).slice(0, 10) : "—"}</td>
                      <td>{renderRemarksCell(r, r.remarks)}</td>
                      <td>
                        <div className="hr-actions">
                          {canEdit && (
                          <button
                            className="hr-btn-edit"
                            title="Edit"
                            onClick={() => navigate(`/records/health/edit/${r._id}?type=vaccination`)}
                          >
                            <FiEdit2 />
                          </button>
                          )}
                          {canArchive && (
                          <button className="hr-btn-archive" onClick={() => requestArchive({ module: "Health Records", moduleKey: "pb_health", record: r, name: r.batchId || r.cage || r.diagnosis })} title="Archive">
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
          <div className="pb-confirm-modal hr-view-modal" onClick={(e) => e.stopPropagation()}>
            {viewRecord.recordType === "Diagnosis" ? (
              <>
                <h3 className="pb-confirm-title">Diagnosis Record</h3>
                <div className="hr-view-columns">
                  <div className="hr-view-col">
                    <h4 className="hr-view-col-title">Diagnosis (System-Managed)</h4>
                    <div className="hr-view-kv"><small>Diagnosis ID</small><p><span className="hr-diagnosis-badge">{viewRecord.diagnosisCode || "—"}</span></p></div>
                    <div className="hr-view-kv"><small>Isolation ID</small><p><span className="hr-isolation-badge">{viewRecord.isolationId?.isolationId || "—"}</span></p></div>
                    <div className="hr-view-kv"><small>Batch ID</small><p><span className="hr-batch-badge">{viewRecord.batchId}</span></p></div>
                    <div className="hr-view-kv"><small>Date</small><p>{fmtDate(viewRecord.date)}</p></div>
                    <div className="hr-view-kv"><small>Age</small><p>{viewRecord.targetAge || "—"}</p></div>
                    <div className="hr-view-kv"><small>Number of Birds Affected</small><p>{viewRecord.numberOfBirdsAffected ?? "—"}</p></div>
                    <div className="hr-view-kv"><small>Number Mortality</small><p>{viewRecord.numberMortality ?? "—"}</p></div>
                    <div className="hr-view-kv"><small>Schedule</small><p>{fmtDate(viewRecord.nextSchedule)}</p></div>
                    <div className="hr-view-kv"><small>Treatment Applied</small><p>{viewRecord.treatmentApplied || "—"}</p></div>
                  </div>

                  <div className="hr-view-col">
                    <h4 className="hr-view-col-title">Assessment (Editable)</h4>
                    <div className="hr-view-kv"><small>Observation</small><p>{viewRecord.symptomsObserved || "—"}</p></div>
                    <div className="hr-view-kv"><small>Presumptive Diagnosis</small><p>{viewRecord.presumptiveDiagnosis || "—"}</p></div>
                    <div className="hr-view-kv"><small>Vet Diagnosis</small><p>{viewRecord.vetDiagnosis || "—"}</p></div>
                  </div>

                  <div className="hr-view-col">
                    <h4 className="hr-view-col-title">Additional Information</h4>
                    <div className="hr-view-kv"><small>Remarks / Follow-up Action</small><p>{viewRecord.remarks || "—"}</p></div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="pb-confirm-title">Medication/Vaccination Record</h3>
                <div className="hr-view-columns">
                  <div className="hr-view-col">
                    <h4 className="hr-view-col-title">Diagnosis Link (Locked)</h4>
                    <div className="hr-view-kv"><small>Medication ID</small><p><span className="hr-medication-badge">{viewRecord.medicationCode || "—"}</span></p></div>
                    <div className="hr-view-kv"><small>Batch ID</small><p><span className="hr-batch-badge">{viewRecord.batchId}</span></p></div>
                    <div className="hr-view-kv"><small>Diagnosis ID</small><p><span className="hr-diagnosis-badge">{diagnosisCodeById[viewRecord.diagnosisId] || "—"}</span></p></div>
                    <div className="hr-view-kv"><small>Date</small><p>{fmtDate(viewRecord.date)}</p></div>
                  </div>

                  <div className="hr-view-col">
                    <h4 className="hr-view-col-title">Treatment Information</h4>
                    <div className="hr-view-kv"><small>No. of Birds Administered</small><p>{viewRecord.numberOfBirdsAdministered ?? "—"}</p></div>
                    <div className="hr-view-kv"><small>Vaccine / Drug</small><p>{viewRecord.vaccineOrDrug || "—"}</p></div>
                    <div className="hr-view-kv"><small>Target Age / Stage</small><p>{viewRecord.targetAge || "—"}</p></div>
                    <div className="hr-view-kv"><small>Route of Administration</small><p>{viewRecord.routeOfAdmin || "—"}</p></div>
                    <div className="hr-view-kv"><small>Dosage</small><p>{viewRecord.dosage ? `${viewRecord.dosage} ${viewRecord.dosageUnit || ""}`.trim() : "—"}</p></div>
                    <div className="hr-view-kv"><small>Frequency</small><p>{viewRecord.frequency || "—"}</p></div>
                  </div>

                  <div className="hr-view-col">
                    <h4 className="hr-view-col-title">Administered By</h4>
                    <div className="hr-view-kv"><small>Type</small><p>{viewRecord.administeredByType || "—"}</p></div>
                    <div className="hr-view-kv"><small>{viewRecord.administeredByType === "Vet" ? "Veterinarian" : "Staff Member"}</small><p>{viewRecord.administeredBy || "—"}</p></div>
                  </div>

                  <div className="hr-view-col">
                    <h4 className="hr-view-col-title">Schedules</h4>
                    {viewRecord.schedules?.length
                      ? viewRecord.schedules.map((s, i) => <div className="hr-view-kv" key={i}><p>{fmtDate(s)}</p></div>)
                      : <div className="hr-view-kv"><p>—</p></div>}
                  </div>

                  <div className="hr-view-col">
                    <h4 className="hr-view-col-title">Additional Information</h4>
                    <div className="hr-view-kv"><small>Remarks</small><p>{viewRecord.remarks || "—"}</p></div>
                  </div>
                </div>
              </>
            )}
            <div className="pb-confirm-actions">
              <button className="pb-confirm-cancel" onClick={() => setViewRecord(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </PageLayout>
  );
}