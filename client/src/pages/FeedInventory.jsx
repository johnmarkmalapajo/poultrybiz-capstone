import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArchive,
  FiBox,
  FiEdit2,
  FiFilter,
  FiPlus,
  FiSearch,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { useUser } from "../hooks/useUser";
import ExportMenu from "../components/ExportMenu";
import "./FeedInventory.css";
import { useArchiveConfirm } from "../hooks/useArchiveConfirm";
import ArchiveConfirmModal from "../components/ArchiveConfirmModal";
import { listFeedInventory } from "../api/feedInventory";
import { listFeedConsumption } from "../api/feedConsumption";
import { getFarmInfo } from "../api/profile";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination from "../components/TablePagination";
import "../components/TablePagination.css";

const FEED_TYPE_OPTIONS = ["Grower Feed", "Layer Feed"];

const FEED_SACK_WEIGHT_KG = 50;

const LOW_STOCK_THRESHOLD = 100;
const CRITICAL_STOCK_THRESHOLD = 50;

export default function FeedInventory() {
  const navigate = useNavigate();
  const { canEdit, canArchive, role } = useUser();

  const {
    pending: archivePending,
    requestArchive,
    cancelArchive,
    confirmArchive,
  } = useArchiveConfirm();

  const [search, setSearch] = useState("");
  const [records, setRecords] = useState([]);
  const [consumed, setConsumed] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [farmInfo, setFarmInfo] = useState({
    farmName: "",
    farmLocation: "",
    farmContact: "",
    farmEmail: "",
    farmLogo: "",
  });

  const [showFilter, setShowFilter] = useState(false);

  const defaultFilters = { feedType: "All", period: "all", year: "All", month: "All", week: "", dateFrom: "", dateTo: "" };
  const [filters, setFilters] = useState(defaultFilters);
  const [draft, setDraft] = useState(defaultFilters);
  const [filterApplied, setFilterApplied] = useState(false);

  const filterRef = useRef(null);

  useEffect(() => {
    const normalizeResponse = (response) => {
      const payload = response?.data ?? response;

      if (Array.isArray(payload)) {
        return payload;
      }

      if (Array.isArray(payload?.records)) {
        return payload.records;
      }

      if (Array.isArray(payload?.data)) {
        return payload.data;
      }

      if (Array.isArray(payload?.flocks)) {
        return payload.flocks;
      }

      return [];
    };

    const loadData = async () => {
      setLoading(true);
      setError("");

      try {
        const [inventoryResponse, consumptionResponse] =
          await Promise.all([
            listFeedInventory(),
            listFeedConsumption(),
          ]);

        const inventoryData = normalizeResponse(inventoryResponse);
        const consumptionData =
          normalizeResponse(consumptionResponse);

        setRecords(inventoryData.map((r) => ({ ...r, date: r.date ? String(r.date).slice(0, 10) : r.date })));

const consumptionMap = {};

consumptionData.forEach((record) => {
  const feedType = String(record?.feedType || "")
    .trim()
    .toLowerCase();

  const quantityConsumed =
    Number(record?.quantityConsumed) || 0;

  const quantityUnit = String(
    record?.quantityUnit || "kg"
  )
    .trim()
    .toLowerCase();

  if (!feedType || quantityConsumed <= 0) {
    return;
  }

  let quantityConsumedKg = quantityConsumed;

  if (quantityUnit === "sacks") {
    quantityConsumedKg =
      quantityConsumed * FEED_SACK_WEIGHT_KG;
  }

  if (feedType === "layer feed") {
    consumptionMap["Layer Feed"] =
      (consumptionMap["Layer Feed"] || 0) +
      quantityConsumedKg;
  }

  if (feedType === "grower feed") {
    consumptionMap["Grower Feed"] =
      (consumptionMap["Grower Feed"] || 0) +
      quantityConsumedKg;
  }
});

setConsumed(consumptionMap);
      } catch (err) {
        setRecords([]);
        setConsumed({});
        setError(
          err?.message || "Couldn't load feed inventory."
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();

    getFarmInfo()
      .then((data) => setFarmInfo(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target)
      ) {
        setShowFilter(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
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
    (filterApplied && filters.feedType !== "All" ? 1 : 0);

  const yearOptions = [...new Set(
    records.map((r) => { const d = new Date(r.date || ""); return isNaN(d) ? null : String(d.getFullYear()); }).filter(Boolean)
  )].sort((a, b) => b - a);

  const monthOptions = [...new Set(
    records
      .filter((r) => draft.year === "All" || String(new Date(r.date || "").getFullYear()) === draft.year)
      .map((r) => { const d = new Date(r.date || ""); return isNaN(d) ? null : MONTH_NAMES[d.getMonth()]; })
      .filter(Boolean)
  )].sort((a, b) => MONTH_NAMES.indexOf(a) - MONTH_NAMES.indexOf(b));

  const normalizeFeedType = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();

const totalQuantityInByType = records.reduce(
  (stock, record) => {
    const feedType = normalizeFeedType(record?.feedType);
    const quantityIn = Number(record?.quantityIn) || 0;

    if (feedType === "layer feed") {
      stock.layer += quantityIn;
    } else if (feedType === "grower feed") {
      stock.grower += quantityIn;
    }

    return stock;
  },
  {
    layer: 0,
    grower: 0,
  }
);

const totalConsumedByTypeKg = {
  layer: Number(consumed["Layer Feed"]) || 0,
  grower: Number(consumed["Grower Feed"]) || 0,
};

const consumedLayerSacks =
  totalConsumedByTypeKg.layer / FEED_SACK_WEIGHT_KG;

const consumedGrowerSacks =
  totalConsumedByTypeKg.grower / FEED_SACK_WEIGHT_KG;

const currentLayerStockSacks = Math.max(
  0,
  totalQuantityInByType.layer - consumedLayerSacks
);

const currentGrowerStockSacks = Math.max(
  0,
  totalQuantityInByType.grower - consumedGrowerSacks
);

const currentLayerStockWhole =
  Math.max(0, Math.floor(currentLayerStockSacks));

const currentGrowerStockWhole =
  Math.max(0, Math.floor(currentGrowerStockSacks));

  const currentLayerStockKg =
    currentLayerStockSacks * FEED_SACK_WEIGHT_KG;

  const currentGrowerStockKg =
    currentGrowerStockSacks * FEED_SACK_WEIGHT_KG;

  const displayRecords = records
    .map((record) => ({
      ...record,
      quantityInSacks: Number(record?.quantityIn) || 0,
      status: "Delivered/Received",
    }))
    .sort((a, b) => {
      const dateA = new Date(
        a.date || a.createdAt || 0
      ).getTime();

      const dateB = new Date(
        b.date || b.createdAt || 0
      ).getTime();

      if (dateA !== dateB) {
        return dateB - dateA;
      }

      return (
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
      );
    });

  const filtered = displayRecords.filter((record) => {
    const searchValue = search.trim().toLowerCase();

    const matchSearch =
      !searchValue ||
      record.feedType?.toLowerCase().includes(searchValue);

    const matchType =
      !filterApplied ||
      filters.feedType === "All" ||
      record.feedType === filters.feedType;

    const matchDate =
      !filterApplied || matchesDatePeriod(record, filters);

    return matchSearch && matchType && matchDate;
  });

  const {
    sortColumn,
    sortDirection,
    cycleSort,
    sortData,
  } = useTableSort();

  const sortAccessor = (row, column) => {
    if (column === "date") {
      return row.date || "";
    }

    if (column === "feedType") {
      return row.feedType || "";
    }

    if (column === "quantityIn") {
      return Number(row.quantityIn) || 0;
    }

    if (column === "status") {
      return row.status || "";
    }

    return "";
  };

  const sorted = sortData(filtered, sortAccessor);

  const pager = usePagination(sorted.length);

  useEffect(() => {
    pager.setPage(1);
  }, [search, filterApplied, filters]);

  const pageRows = sorted.slice(
    pager.startIndex,
    pager.endIndex
  );

  const criticalTypes = [];

  if (currentLayerStockKg <= CRITICAL_STOCK_THRESHOLD) {
    criticalTypes.push("Layer Feed");
  }

  if (currentGrowerStockKg <= CRITICAL_STOCK_THRESHOLD) {
    criticalTypes.push("Grower Feed");
  }

  const lowTypes = [];

  if (
    currentLayerStockKg > CRITICAL_STOCK_THRESHOLD &&
    currentLayerStockKg <= LOW_STOCK_THRESHOLD
  ) {
    lowTypes.push("Layer Feed");
  }

  if (
    currentGrowerStockKg > CRITICAL_STOCK_THRESHOLD &&
    currentGrowerStockKg <= LOW_STOCK_THRESHOLD
  ) {
    lowTypes.push("Grower Feed");
  }

  const periodLabel =
    filters.dateFrom && filters.dateTo
      ? `${filters.dateFrom} – ${filters.dateTo}`
      : filters.dateFrom
        ? `From ${filters.dateFrom}`
        : filters.dateTo
          ? `Until ${filters.dateTo}`
          : "All Time";

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
    fields:
      filters.feedType !== "All"
        ? [
            {
              label: "Feed Type",
              value: filters.feedType,
            },
          ]
        : [],
  };

  const exportSummary = [
    {
      label: "Current Layer Stock",
      value: `${currentLayerStockWhole} sacks`,
    },
    {
      label: "Current Grower Stock",
      value: `${currentGrowerStockWhole} sacks`,
    },
  ];

  const exportColumns = [
    {
      key: "date",
      label: "Date",
    },
    {
      key: "feedType",
      label: "Feed Type",
    },
    {
      key: "quantityIn",
      label: "Quantity",
    },
    {
      key: "status",
      label: "Status",
    },
  ];

  const exportRows = filtered.map((record) => ({
    date: record.date
      ? new Date(record.date)
          .toISOString()
          .split("T")[0]
      : "—",
    feedType: record.feedType || "—",
    quantityIn: `${Math.floor(
      Number(record.quantityIn) || 0
    )} sacks`,
    status: record.status,
  }));

  const handleAddNewFeeds = () => {
    navigate(
      "/sales-transactions/expenses/add?category=Feed%20Purchase"
    );
  };

  const handleEmptyAdd = () => {
    navigate(
      "/sales-transactions/expenses/add?category=Feed%20Purchase"
    );
  };

  const handleEdit = (record) => {
    navigate(
      `/inventory/feed-inventory/edit/${record._id}`
    );
  };

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
          label: "FEED INVENTORY",
        },
      ]}
    >
      <div className="fi-toolbar">
        {role !== "Farmer" && (
          <button
            type="button"
             className="fi-add-btn"
            onClick={handleAddNewFeeds}
            >
          <FiPlus />
            Add New Feeds
          </button>
          )}

        <div className="fi-toolbar-right">
          <div className="fi-search-box">
            <FiSearch />

            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <div className="fi-btn-group">
            <div
              className="fi-filter-wrap"
              ref={filterRef}
            >
              <button
                type="button"
                className="fi-toolbar-btn"
                onClick={openFilterPanel}
              >
                <FiFilter />
                Filter

                {activeFilterCount > 0 && (
                  <span className="fi-filter-count">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {showFilter && (
                <div className="fi-filter-dropdown">
                  <div className="fi-filter-dropdown-header">
                    <span>Filter Records</span>
                  </div>

                  <div className="fi-filter-section-label">Date Filter</div>
                  <div className="fi-filter-row">
                    <div className="fi-filter-group">
                      <label className="fi-filter-label">Date Period</label>
                      <select
                        className="fi-filter-select"
                        value={draft.period}
                        onChange={(event) => handleFilterChange("period", event.target.value)}
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
                      <div className="fi-filter-group">
                        <label className="fi-filter-label">Week</label>
                        <input
                          type="week"
                          className="fi-filter-select"
                          value={draft.week}
                          onChange={(event) => handleFilterChange("week", event.target.value)}
                        />
                      </div>
                    )}

                    {draft.period === "month" && (
                      <div className="fi-filter-group">
                        <label className="fi-filter-label">Month</label>
                        <select
                          className="fi-filter-select"
                          value={draft.month}
                          onChange={(event) => handleFilterChange("month", event.target.value)}
                        >
                          <option value="All">Select Month</option>
                          {monthOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {(draft.period === "month" || draft.period === "year") && (
                      <div className="fi-filter-group">
                        <label className="fi-filter-label">Year</label>
                        <select
                          className="fi-filter-select"
                          value={draft.year}
                          onChange={(event) => handleFilterChange("year", event.target.value)}
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
                    <div className="fi-filter-group">
                      <label className="fi-filter-label">Start Date / End Date</label>
                      <div className="fi-filter-date-range">
                        <input
                          type="date"
                          className="fi-filter-select"
                          value={draft.dateFrom}
                          max={draft.dateTo || todayStr()}
                          onChange={(event) => handleFilterChange("dateFrom", event.target.value)}
                          aria-label="From date"
                        />
                        <span>to</span>
                        <input
                          type="date"
                          className="fi-filter-select"
                          value={draft.dateTo}
                          min={draft.dateFrom || undefined}
                          max={todayStr()}
                          onChange={(event) => handleFilterChange("dateTo", event.target.value)}
                          aria-label="To date"
                        />
                      </div>
                    </div>
                  )}

                  <div className="fi-filter-section-label">Filters</div>
                  <div className="fi-filter-group">
                    <label className="fi-filter-label">
                      Feed Type
                    </label>

                    <select
                      className="fi-filter-select"
                      value={draft.feedType}
                      onChange={(event) =>
                        handleFilterChange(
                          "feedType",
                          event.target.value
                        )
                      }
                    >
                      <option value="All">
                        All Feed Types
                      </option>

                      {FEED_TYPE_OPTIONS.map((option) => (
                        <option
                          key={option}
                          value={option}
                        >
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fi-filter-actions">
                    <button className="fi-filter-clear" onClick={clearFilters}>Clear All</button>
                    <button className="fi-filter-apply" onClick={applyFilters}>Apply</button>
                  </div>
                </div>
              )}
            </div>

            <ExportMenu
              rows={exportRows}
              columns={exportColumns}
              name="feed-inventory"
              title="Feed Inventory Report"
              meta={exportMeta}
              pdfExtra={{
                period: exportMeta.period,
                summary: exportSummary,
              }}
              moduleLabel="Feed Inventory"
              enablePreview
              filters={{
                ...(filters.feedType !== "All"
                  ? {
                      "Feed Type": filters.feedType,
                    }
                  : {}),
                ...(periodLabel !== "All Time"
                  ? {
                      "Report Period": periodLabel,
                    }
                  : {}),
              }}
              className="fi-toolbar-btn"
            />
          </div>
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="fi-active-filters">
          {Object.entries(filters).map(
            ([key, value]) =>
              value !== "All" &&
              value !== "" && (
                <span
                  key={key}
                  className="fi-active-filter-tag"
                >
                  {key === "feedType"
                    ? "Feed Type"
                    : key === "dateFrom"
                      ? "From"
                      : key === "dateTo"
                        ? "To"
                        : key}
                  : {value}

                  <button
                    type="button"
                    onClick={() =>
                      handleFilterChange(
                        key,
                        key === "dateFrom" ||
                          key === "dateTo"
                          ? ""
                          : "All"
                      )
                    }
                  >
                    ✕
                  </button>
                </span>
              )
          )}
        </div>
      )}

      {error && (
        <div className="pb-error-banner">
          {error}
        </div>
      )}

      {!loading && criticalTypes.length > 0 && (
        <div className="pb-error-banner">
          ⛔ Critical Stock: {criticalTypes.join(", ")} at
          or below {CRITICAL_STOCK_THRESHOLD} kg. Restock
          immediately.
        </div>
      )}

      {!loading && lowTypes.length > 0 && (
        <div className="pb-warning-banner">
          ⚠️ Low Stock: {lowTypes.join(", ")} at or below{" "}
          {LOW_STOCK_THRESHOLD} kg. Consider restocking
          soon.
        </div>
      )}

      <div className="fi-stats-grid">
        <div className="fi-stat-card">
          <div className="fi-stat-icon green">
            <FiBox />
          </div>

          <div>
            <h3>
  {currentLayerStockWhole} sacks
</h3>
<p>Current Layer Stock</p>
<span>≈ {Math.floor(currentLayerStockKg).toLocaleString()} kg</span>
          </div>
        </div>

        <div className="fi-stat-card">
          <div className="fi-stat-icon blue">
            <FiBox />
          </div>

          <div>
            <h3>
  {currentGrowerStockWhole} sacks
</h3>
<p>Current Grower Stock</p>
<span>≈ {Math.floor(currentGrowerStockKg).toLocaleString()} kg</span>
          </div>
        </div>
      </div>

      <div className="fi-table-wrapper">
        <table className="fi-table">
          <thead>
            <tr>
              <th
                className="fi-sortable-th"
                onClick={() => cycleSort("date")}
              >
                Date
                {sortIndicator(
                  "date",
                  sortColumn,
                  sortDirection
                )}
              </th>

              <th
                className="fi-sortable-th"
                onClick={() => cycleSort("feedType")}
              >
                Feed Type
                {sortIndicator(
                  "feedType",
                  sortColumn,
                  sortDirection
                )}
              </th>

              <th
                className="fi-sortable-th"
                onClick={() => cycleSort("quantityIn")}
              >
                Quantity
                {sortIndicator(
                  "quantityIn",
                  sortColumn,
                  sortDirection
                )}
              </th>

              <th
                className="fi-sortable-th"
                onClick={() => cycleSort("status")}
              >
                Status
                {sortIndicator(
                  "status",
                  sortColumn,
                  sortDirection
                )}
              </th>

              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="5"
                  className="fi-empty-state"
                >
                  Loading feed inventory...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan="5"
                  className="fi-empty-state"
                >
                  <div className="fi-empty-content">
                    <FiBox />

                    <h3>
                      No feed stock records found
                    </h3>

                    <p>
                      Click Add New Feeds to record your
                      first transaction.
                    </p>

                    {role !== "Farmer" && (
  <button
    type="button"
    className="fi-empty-add-btn"
    onClick={handleEmptyAdd}
  >
    <FiPlus />
    Add New Feeds
  </button>
)}
                  </div>
                </td>
              </tr>
            ) : (
              pageRows.map((record) => (
                <tr key={record._id}>
                  <td>
                    {record.date
                      ? new Date(record.date)
                          .toISOString()
                          .split("T")[0]
                      : "—"}
                  </td>

                  <td>{record.feedType || "—"}</td>

                  <td>
                    {Math.floor(
                      Number(record.quantityIn) || 0
                    )}{" "}
                    sacks
                  </td>

                  <td>
                    <span
                      className={`fi-status fi-status-${record.status
                        .toLowerCase()
                        .replace(/[\/\s]+/g, "-")}`}
                    >
                      {record.status}
                    </span>
                  </td>

                  <td>
                    <div className="fi-actions">
                      {canEdit && (
                        <button
                          type="button"
                          className="fi-btn-edit"
                          title="Edit"
                          onClick={() =>
                            handleEdit(record)
                          }
                        >
                          <FiEdit2 />
                        </button>
                      )}

                      {canArchive && (
                        <button
                          type="button"
                          className="fi-btn-archive"
                          title="Archive"
                          onClick={() =>
                            requestArchive({
                              module: "Feed Inventory",
                              moduleKey:
                                "pb_feed_inventory",
                              record,
                              name:
                                record.feedType ||
                                record.name ||
                                "Feed Record",
                            })
                          }
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
          setRowsPerPage={pager.setRowsPerPage}
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