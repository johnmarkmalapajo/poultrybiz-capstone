import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus,
  FiSearch,
  FiFilter,
  FiEdit2,
  FiArchive,
  FiGrid,
  FiPackage,
  FiUsers,
  FiLayers,
  FiMaximize,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { useUser } from "../hooks/useUser";
import ExportMenu from "../components/ExportMenu";
import "./FeedConsumption.css";
import { useArchiveConfirm } from "../hooks/useArchiveConfirm";
import ArchiveConfirmModal from "../components/ArchiveConfirmModal";
import { listFeedConsumption } from "../api/feedConsumption";
import { listFlocks } from "../api/flockProfile";
import { getFarmInfo } from "../api/profile";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination from "../components/TablePagination";
import "../components/TablePagination.css";

const FEED_TYPE_OPTIONS = ["Grower Feed", "Layer Feed"];
const FEED_SACK_WEIGHT_KG = 50;

export default function FeedConsumption() {
  const navigate = useNavigate();
  const { canEdit, canArchive } = useUser();

  const {
    pending: archivePending,
    requestArchive,
    cancelArchive,
    confirmArchive,
  } = useArchiveConfirm();

  const [search, setSearch] = useState("");
  const [records, setRecords] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [farmInfo, setFarmInfo] = useState({
    farmName: "",
    farmLocation: "",
    farmContact: "",
    farmEmail: "",
    farmLogo: "",
  });

  const loadFeedConsumption = async () => {
    try {
      const json = await listFeedConsumption();

      const list =
        json.data ||
        json.records ||
        (Array.isArray(json) ? json : []);

      setRecords(list.map((r) => ({ ...r, date: r.date ? String(r.date).slice(0, 10) : r.date })));
      setError("");
    } catch (err) {
      setRecords([]);
      setError(
        err?.message ||
          "Couldn't load feed consumption records."
      );
    }
  };

  const loadFlocks = async () => {
    try {
      const data = await listFlocks();

      setFlocks(
        Array.isArray(data)
          ? data
          : data.records ||
              data.data ||
              data.flocks ||
              []
      );
    } catch {
      setFlocks([]);
    }
  };

  const loadFarmInfo = async () => {
    try {
      const data = await getFarmInfo();

      setFarmInfo(data);
    } catch {
      setFarmInfo({
        farmName: "",
        farmLocation: "",
        farmContact: "",
        farmEmail: "",
        farmLogo: "",
      });
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);

      await Promise.all([
        loadFeedConsumption(),
        loadFlocks(),
        loadFarmInfo(),
      ]);

      setLoading(false);
    };

    loadInitialData();

    const handleDataChanged = () => {
      loadFeedConsumption();
      loadFlocks();
      loadFarmInfo();
    };

    window.addEventListener(
      "pb_data_changed",
      handleDataChanged
    );

    return () => {
      window.removeEventListener(
        "pb_data_changed",
        handleDataChanged
      );
    };
  }, []);

  const [showFilter, setShowFilter] = useState(false);

  const defaultFilters = { batchId: "All", feedType: "All", period: "all", year: "All", month: "All", week: "", dateFrom: "", dateTo: "" };
  const [filters, setFilters] = useState(defaultFilters);
  const [draft, setDraft] = useState(defaultFilters);
  const [filterApplied, setFilterApplied] = useState(false);

  const filterRef = useRef(null);


  useEffect(() => {
    const handle = (e) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(e.target)
      ) {
        setShowFilter(false);
      }
    };

    document.addEventListener("mousedown", handle);

    return () =>
      document.removeEventListener(
        "mousedown",
        handle
      );
  }, []);

  const handleFilterChange = (key, value) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setDraft(defaultFilters);
    setFilters(defaultFilters);
    setFilterApplied(false);
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
    const raw = r.date || "";
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
    (filterApplied && filters.batchId !== "All" ? 1 : 0) +
    (filterApplied && filters.feedType !== "All" ? 1 : 0);

  const uniq = (values) => [
    ...new Set(values.filter(Boolean)),
  ];

  const batchOptions = uniq(
    records.map((record) => record.batchId)
  );

  const yearOptions = uniq(
    records.map((r) => { const d = new Date(r.date || ""); return isNaN(d) ? null : String(d.getFullYear()); })
  ).sort((a, b) => b - a);

  const monthOptions = uniq(
    records
      .filter((r) => draft.year === "All" || String(new Date(r.date || "").getFullYear()) === draft.year)
      .map((r) => { const d = new Date(r.date || ""); return isNaN(d) ? null : MONTH_NAMES[d.getMonth()]; })
  ).sort((a, b) => MONTH_NAMES.indexOf(a) - MONTH_NAMES.indexOf(b));

  const filtered = records.filter((record) => {
    const matchSearch = record.batchId
      ?.toLowerCase()
      .includes(search.toLowerCase());

    const matchBatch =
      !filterApplied ||
      filters.batchId === "All" ||
      record.batchId === filters.batchId;

    const matchType =
      !filterApplied ||
      filters.feedType === "All" ||
      record.feedType === filters.feedType;

    const matchDate =
      !filterApplied || matchesDatePeriod(record, filters);

    return (
      matchSearch &&
      matchBatch &&
      matchType &&
      matchDate
    );
  });

  const {
    sortColumn,
    sortDirection,
    cycleSort,
    sortData,
  } = useTableSort();

  const sortAccessor = (row, column) => {
    if (column === "date") return row.date || "";
    if (column === "batchId") return row.batchId || "";
    if (column === "feedType") return row.feedType || "";

    if (column === "quantityConsumed") {
      return Number(row.quantityConsumed) || 0;
    }

    return "";
  };

  const sorted = sortData(
    filtered,
    sortAccessor
  );

  const pager = usePagination(sorted.length);

  useEffect(() => {
    pager.setPage(1);
  }, [search, filterApplied, filters]);

  const pageRows = sorted.slice(
    pager.startIndex,
    pager.endIndex
  );

  const totalRecords = filtered.length;

  const totalConsumed = filtered.reduce(
    (sum, record) => {
      const quantity =
        Number(record.quantityConsumed) || 0;

      const unit = String(
        record.quantityUnit || "kg"
      ).toLowerCase();

      const consumedKg = unit.includes("sack")
        ? quantity * FEED_SACK_WEIGHT_KG
        : quantity;

      return sum + consumedKg;
    },
    0
  );

  const batchesFed = uniq(
    filtered.map((record) => record.batchId)
  ).length;

  const feedTypesUsed = uniq(
    filtered.map((record) => record.feedType)
  ).length;

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

  const selectedFlock =
    filters.batchId !== "All"
      ? flocks.find(
          (flock) =>
            flock.batchId === filters.batchId
        )
      : null;

  const breedsInView = uniq(
    filtered.map(
      (record) =>
        flocks.find(
          (flock) =>
            flock.batchId === record.batchId
        )?.breed
    )
  );

  const breedLabel = selectedFlock
    ? selectedFlock.breed || "—"
    : breedsInView.length === 1
      ? breedsInView[0]
      : breedsInView.length > 1
        ? "Various"
        : "—";

  const periodLabel = statCardSpanLabel;

  const exportMeta = {
    farmName: farmInfo.farmName,
    location: farmInfo.farmLocation,
    contact: farmInfo.farmContact,
    email: farmInfo.farmEmail,
    logoUrl: farmInfo.farmLogo
      ? farmInfo.farmLogo.startsWith("http")
        ? farmInfo.farmLogo
        : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${farmInfo.farmLogo}`
      : "",
    period: periodLabel,
    fields: [
      ...(filters.batchId !== "All"
        ? [
            {
              label: "Batch ID",
              value: filters.batchId,
            },
          ]
        : []),
      ...(breedLabel !== "—"
        ? [
            {
              label: "Breed",
              value: breedLabel,
            },
          ]
        : []),
      ...(filters.feedType !== "All"
        ? [
            {
              label: "Feed Type",
              value: filters.feedType,
            },
          ]
        : []),
    ],
  };

  const exportSummary = filtered.length
    ? [
        {
          label: "Total Records",
          value: String(totalRecords),
        },
        {
          label: "Total Consumed",
          value: `${totalConsumed} kg`,
        },
        {
          label: "Batches Fed",
          value: String(batchesFed),
        },
        {
          label: "Feed Types Used",
          value: String(feedTypesUsed),
        },
      ]
    : [];

  const exportColumns = [
    {
      key: "date",
      label: "Date",
    },
    {
      key: "batchId",
      label: "Batch ID",
    },
    {
      key: "feedType",
      label: "Feed Type",
    },
    {
      key: "quantityConsumed",
      label: "Quantity Consumed",
    },
    {
      key: "notes",
      label: "Notes",
    },
  ];

  const exportRows = filtered.map((record) => ({
    date: record.date
      ? new Date(record.date)
          .toISOString()
          .split("T")[0]
      : "—",

    batchId: record.batchId || "—",

    feedType: record.feedType || "—",

    quantityConsumed: `${record.quantityConsumed ?? 0} ${
      String(
        record.quantityUnit || "kg"
      )
        .toLowerCase()
        .includes("sack")
        ? "sacks"
        : "kg"
    }`,

    notes: record.notes || "—",
  }));

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        {
          label: "INVENTORY",
          path: "/inventory",
        },
        {
          label: "FEED CONSUMPTION",
        },
      ]}
    >
      <div className="fc-toolbar">
        <button
          className="fc-add-btn"
          onClick={() =>
            navigate(
              "/inventory/feed-consumption/add"
            )
          }
        >
          <FiPlus />
          Add Feed Consumption
        </button>

        <div className="fc-toolbar-right">
          <div className="fc-search-box">
            <FiSearch />

            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />
          </div>

          <div className="fc-btn-group">
            <div
              className="fc-filter-wrap"
              ref={filterRef}
            >
              <button
                className="fc-toolbar-btn"
                onClick={openFilterPanel}
              >
                <FiFilter />
                Filter

                {activeFilterCount > 0 && (
                  <span className="fc-filter-count">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {showFilter && (
                <div className="fc-filter-dropdown">
                  <div className="fc-filter-dropdown-header">
                    <span>Filter Records</span>
                  </div>

                  <div className="fc-filter-section-label">Date Filter</div>
                  <div className="fc-filter-row">
                    <div className="fc-filter-group">
                      <label className="fc-filter-label">Date Period</label>
                      <select
                        className="fc-filter-select"
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
                      <div className="fc-filter-group">
                        <label className="fc-filter-label">Week</label>
                        <input
                          type="week"
                          className="fc-filter-select"
                          value={draft.week}
                          onChange={(e) => handleFilterChange("week", e.target.value)}
                        />
                      </div>
                    )}

                    {draft.period === "month" && (
                      <div className="fc-filter-group">
                        <label className="fc-filter-label">Month</label>
                        <select
                          className="fc-filter-select"
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
                      <div className="fc-filter-group">
                        <label className="fc-filter-label">Year</label>
                        <select
                          className="fc-filter-select"
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
                    <div className="fc-filter-group">
                      <label className="fc-filter-label">Start Date / End Date</label>
                      <div className="fc-filter-date-range">
                        <input
                          type="date"
                          className="fc-filter-select"
                          value={draft.dateFrom}
                          max={draft.dateTo || todayStr()}
                          onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                          aria-label="From date"
                        />
                        <span>to</span>
                        <input
                          type="date"
                          className="fc-filter-select"
                          value={draft.dateTo}
                          min={draft.dateFrom || undefined}
                          max={todayStr()}
                          onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                          aria-label="To date"
                        />
                      </div>
                    </div>
                  )}

                  <div className="fc-filter-section-label">Filters</div>
                  <div className="fc-filter-group">
                    <label className="fc-filter-label">
                      Batch ID
                    </label>

                    <select
                      className="fc-filter-select"
                      value={draft.batchId}
                      onChange={(e) =>
                        handleFilterChange(
                          "batchId",
                          e.target.value
                        )
                      }
                    >
                      <option value="All">
                        All Batches
                      </option>

                      {batchOptions.map((option) => (
                        <option
                          key={option}
                          value={option}
                        >
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fc-filter-group">
                    <label className="fc-filter-label">
                      Feed Type
                    </label>

                    <select
                      className="fc-filter-select"
                      value={draft.feedType}
                      onChange={(e) =>
                        handleFilterChange(
                          "feedType",
                          e.target.value
                        )
                      }
                    >
                      <option value="All">
                        All Feed Types
                      </option>

                      {FEED_TYPE_OPTIONS.map(
                        (option) => (
                          <option
                            key={option}
                            value={option}
                          >
                            {option}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="fc-filter-actions">
                    <button className="fc-filter-clear" onClick={clearFilters}>Clear All</button>
                    <button className="fc-filter-apply" onClick={applyFilters}>Apply</button>
                  </div>
                </div>
              )}
            </div>

            <ExportMenu
              rows={exportRows}
              columns={exportColumns}
              name="feed-consumption"
              title="Feed Consumption Report"
              meta={exportMeta}
              pdfExtra={{
                period: exportMeta.period,
                summary: exportSummary,
              }}
              moduleLabel="Feed Consumption"
              enablePreview
              filters={{
                ...(filters.batchId !== "All"
                  ? {
                      "Batch ID":
                        filters.batchId,
                    }
                  : {}),

                ...(filters.feedType !== "All"
                  ? {
                      "Feed Type":
                        filters.feedType,
                    }
                  : {}),

                ...(filterApplied && filters.period !== "all"
                  ? {
                      "Report Period":
                        periodLabel,
                    }
                  : {}),
              }}
              className="fc-toolbar-btn"
            />
          </div>
        </div>
      </div>

      {error && (
        <div
          className="fc-active-filters"
          style={{ color: "#d94f4f" }}
        >
          {error}
        </div>
      )}

      <div className="fc-stats-grid">
        <div className="fc-stat-card">
          <div className="fc-stat-icon gold">
            <FiGrid />
          </div>

          <div>
            <h3>{totalRecords}</h3>
            <p>Total Records</p>
            <span>{statCardSpanLabel}</span>
          </div>
        </div>

        <div className="fc-stat-card">
          <div className="fc-stat-icon green">
            <FiPackage />
          </div>

          <div>
            <h3>
              {Number(totalConsumed.toFixed(2))} kg
            </h3>
            <p>Total Consumed</p>
            <span>{statCardSpanLabel}</span>
          </div>
        </div>

        <div className="fc-stat-card">
          <div className="fc-stat-icon blue">
            <FiUsers />
          </div>

          <div>
            <h3>{batchesFed}</h3>
            <p>Batches Fed</p>
            <span>{statCardSpanLabel}</span>
          </div>
        </div>

        <div className="fc-stat-card">
          <div className="fc-stat-icon red">
            <FiLayers />
          </div>

          <div>
            <h3>{feedTypesUsed}</h3>
            <p>Feed Types Used</p>
            <span>{statCardSpanLabel}</span>
          </div>
        </div>
      </div>

      <div className="fc-table-wrapper">
        <table className="fc-table">
          <thead>
            <tr>
              <th
                className="fc-sortable-th"
                onClick={() =>
                  cycleSort("date")
                }
              >
                Date
                {sortIndicator(
                  "date",
                  sortColumn,
                  sortDirection
                )}
              </th>

              <th
                className="fc-sortable-th"
                onClick={() =>
                  cycleSort("batchId")
                }
              >
                Batch ID
                {sortIndicator(
                  "batchId",
                  sortColumn,
                  sortDirection
                )}
              </th>

              <th
                className="fc-sortable-th"
                onClick={() =>
                  cycleSort("feedType")
                }
              >
                Feed Type
                {sortIndicator(
                  "feedType",
                  sortColumn,
                  sortDirection
                )}
              </th>

              <th
                className="fc-sortable-th"
                onClick={() =>
                  cycleSort(
                    "quantityConsumed"
                  )
                }
              >
                Quantity Consumed
                {sortIndicator(
                  "quantityConsumed",
                  sortColumn,
                  sortDirection
                )}
              </th>

              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="6"
                  className="fc-empty-state"
                >
                  Loading feed consumption...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  className="fc-empty-state"
                >
                  <div className="fc-empty-content">
                    <FiMaximize />

                    <h3>
                      No feed consumption records
                      found
                    </h3>

                    <p>
                      Click Add Feed Consumption to
                      record your first entry.
                    </p>

                    <button
                      className="fc-empty-add-btn"
                      onClick={() =>
                        navigate(
                          "/inventory/feed-consumption/add"
                        )
                      }
                    >
                      <FiPlus />
                      Add Feed Consumption
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              pageRows.map((record) => (
                <tr
                  key={
                    record._id ||
                    record.id
                  }
                >
                  <td>
                    {record.date
                      ? new Date(record.date)
                          .toISOString()
                          .split("T")[0]
                      : ""}
                  </td>

                  <td>{record.batchId}</td>

                  <td>{record.feedType}</td>

                  <td>
                    <strong>
                      {record.quantityConsumed}{" "}
                      {String(
                        record.quantityUnit ||
                          "kg"
                      )
                        .toLowerCase()
                        .includes("sack")
                        ? "sacks"
                        : "kg"}
                    </strong>
                  </td>

                  <td>{record.notes}</td>

                  <td>
                    <div className="fc-actions">
                      {canEdit && (
                        <button
                          className="fc-btn-edit"
                          title="Edit"
                          onClick={() =>
                            navigate(
                              `/inventory/feed-consumption/edit/${
                                record._id ||
                                record.id
                              }`
                            )
                          }
                        >
                          <FiEdit2 />
                        </button>
                      )}

                      {canArchive && (
                        <button
                          className="fc-btn-archive"
                          onClick={() =>
                            requestArchive({
                              module:
                                "Feed Consumption",
                              moduleKey:
                                "pb_feed_consumption",
                              record,
                              name:
                                record.feedType ||
                                record.batchId,
                            })
                          }
                          title="Archive"
                        >
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
          setRowsPerPage={
            pager.setRowsPerPage
          }
          totalPages={pager.totalPages}
          startIndex={pager.startIndex}
          endIndex={pager.endIndex}
          totalItems={pager.totalItems}
        />
      </div>

      <ArchiveConfirmModal
        pending={archivePending}
        onCancel={cancelArchive}
        onConfirm={confirmArchive}
      />
    </PageLayout>
  );
}