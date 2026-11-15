import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload,
  FiEdit2, FiDollarSign,
  FiTrendingUp, FiMaximize, FiTag, FiX, FiSave,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import ExportMenu from "../components/ExportMenu";
import { useUser } from "../hooks/useUser";
import "./SalesRecord.css";
import { listSalesRecords, getEggPrices, updateEggPrices } from "../api/salesRecord";
import { EGG_SIZES, sanitizeDecimal, configuredPriceText, priceText, PRICE_2DP } from "../components/SaleItemsEditor";
import "../components/ProofOfCompletionModal.css";
import { getFarmInfo } from "../api/profile";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination, { TableSection, TableScroll } from "../components/TablePagination";
import { useLanguage } from "../i18n/LanguageContext";

const summarizeSizes = (items) => {
  if (!items || !items.length) return "—";
  const sizes = [...new Set(items.map((i) => i.eggSize))];
  return sizes.length <= 2 ? sizes.join(", ") : `${sizes.slice(0, 2).join(", ")} +${sizes.length - 2} more`;
};

export default function SalesRecord() {
  const { t: tr } = useLanguage();
  const navigate = useNavigate();
  const { canEdit, isOwner } = useUser();

  // ── Egg Pricing (Owner only) ──
  // Selling price per egg for each egg size; new sales fill their Unit
  // Price from these. Saved on the server (farm settings), so they are the
  // same on every device and after logging in again.
  const [pricingOpen, setPricingOpen] = useState(false);
  const [pricingDraft, setPricingDraft] = useState({});
  const [pricingMeta, setPricingMeta] = useState({ updatedAt: null, updatedBy: "" });
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingError, setPricingError] = useState("");
  const [pricingSaved, setPricingSaved] = useState(false);

  const openPricing = async () => {
    setPricingOpen(true);
    setPricingError("");
    setPricingSaved(false);
    setPricingLoading(true);
    try {
      const d = await getEggPrices();
      const draftValues = {};
      EGG_SIZES.forEach((size) => { draftValues[size] = configuredPriceText(d?.prices, size); });
      setPricingDraft(draftValues);
      setPricingMeta({ updatedAt: d?.updatedAt || null, updatedBy: d?.updatedBy || "" });
    } catch (err) {
      setPricingError(tr(err?.message || "Unable to load egg prices."));
    } finally {
      setPricingLoading(false);
    }
  };
  const closePricing = () => { if (!pricingSaving) setPricingOpen(false); };

  // A price is a non-negative amount with up to 2 decimals, or blank
  // (no price set: that size can't be sold until one is set).
  const pricingRowError = (value) => {
    const v = String(value ?? "").trim();
    if (v === "") return "";
    if (!PRICE_2DP.test(v)) return tr("Enter a valid amount, e.g. 6.50.");
    if (Number(v) > 100000) return tr("Price is too high.");
    return "";
  };
  const pricingHasErrors = EGG_SIZES.some((size) => pricingRowError(pricingDraft[size]));
  const pricingAllBlank = EGG_SIZES.every((size) => String(pricingDraft[size] ?? "").trim() === "");

  const savePricing = async () => {
    if (pricingSaving || pricingHasErrors) return;
    if (pricingAllBlank) { setPricingError(tr("Set a price for at least one egg size.")); return; }
    setPricingSaving(true);
    setPricingError("");
    try {
      const prices = {};
      EGG_SIZES.forEach((size) => {
        const v = String(pricingDraft[size] ?? "").trim();
        // Sent as the exact text ("6.25"); the server validates 2 decimals.
        prices[size] = v === "" ? null : v;
      });
      const d = await updateEggPrices(prices);
      const saved = {};
      EGG_SIZES.forEach((size) => { saved[size] = configuredPriceText(d?.prices, size); });
      setPricingDraft(saved);
      setPricingMeta({ updatedAt: d?.updatedAt || null, updatedBy: d?.updatedBy || "" });
      setPricingSaved(true);
    } catch (err) {
      setPricingError(tr(err?.message || "Unable to save egg prices."));
    } finally {
      setPricingSaving(false);
    }
  };

  useEffect(() => {
    if (!pricingOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") closePricing(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const [records, setRecords] = useState([]);
  const [search, setSearch]   = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const defaultFilters = { eggSize: "All", period: "all", year: "All", month: "All", week: "", dateFrom: "", dateTo: "" };
  const [filters, setFilters] = useState(defaultFilters);
  const [draft, setDraft] = useState(defaultFilters);
  const [filterApplied, setFilterApplied] = useState(false);
  const filterRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [farmInfo, setFarmInfo] = useState({ farmName: "", farmLocation: "", farmContact: "", farmEmail: "", farmLogo: "" });

  const fetchRecords = useCallback(async (q = "") => {
    setLoading(true);
    setError("");
    try {
      const data = await listSalesRecords(q ? { search: q } : undefined);
      if (data.success !== false) {
        const recs = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
        setRecords(recs);
      } else {
        setError(tr(data.message || "Failed to load records."));
      }
    } catch (err) {
      setError(tr(err?.message || "Cannot connect to server. Please try again."));
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => fetchRecords(search), 400);
    return () => clearTimeout(timer);
  }, [search, fetchRecords]);

  useEffect(() => {
    getFarmInfo().then((d) => setFarmInfo(d)).catch(() => {});
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
        setError(tr("Start date cannot be a future date."));
        return;
      }
      if (draft.dateTo && draft.dateTo > today) {
        setError(tr("End date cannot be a future date."));
        return;
      }
      if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) {
        setError(tr("Start date cannot be later than end date."));
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
    (filterApplied && filters.eggSize !== "All" ? 1 : 0);

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const todayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  const saleDate = (r) => (r.dateOfSale ? String(r.dateOfSale).slice(0, 10) : "");

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
    records.map((r) => { const d = new Date(saleDate(r)); return isNaN(d) ? null : String(d.getFullYear()); }).filter(Boolean)
  )].sort((a, b) => b - a);

  const monthOptions = [...new Set(
    records
      .filter((r) => draft.year === "All" || String(new Date(saleDate(r)).getFullYear()) === draft.year)
      .map((r) => { const d = new Date(saleDate(r)); return isNaN(d) ? null : MONTH_NAMES[d.getMonth()]; })
      .filter(Boolean)
  )].sort((a, b) => MONTH_NAMES.indexOf(a) - MONTH_NAMES.indexOf(b));

  const matchesDatePeriod = (r, f) => {
    if (f.period === "all") return true;
    const date = saleDate(r);
    const d = new Date(date);
    const recYear = isNaN(d) ? null : String(d.getFullYear());
    const recMonth = isNaN(d) ? null : MONTH_NAMES[d.getMonth()];
    if (f.period === "today") return date === todayStr();
    if (f.period === "week") return !!f.week && isoWeekOf(date) === f.week;
    if (f.period === "month") return f.year !== "All" && f.month !== "All" && recYear === f.year && recMonth === f.month;
    if (f.period === "year") return f.year !== "All" && recYear === f.year;
    if (f.period === "custom") return (!f.dateFrom || date >= f.dateFrom) && (!f.dateTo || date <= f.dateTo);
    return true;
  };

  const uniq = (vals) => [...new Set(vals.filter(Boolean))];
  const eggSizeOptions = uniq(records.flatMap((r) => (r.items || []).map((i) => i.eggSize)));

  const filtered = records.filter(
    (r) =>
      !filterApplied || (
        (filters.eggSize === "All" || (r.items || []).some((i) => i.eggSize === filters.eggSize)) &&
        matchesDatePeriod(r, filters)
      )
  );

  const liveStats = {
    totalSalesRecords: filtered.length,
    totalRevenue: filtered.reduce((s, r) => s + (Number(r.grandTotal) || 0), 0),
    totalEggsSold: filtered.reduce((s, r) => s + (Number(r.totalEggs) || 0), 0),
  };

  const formatPeso  = (n) => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatEggs  = (n) => `${Number(n || 0).toLocaleString("en-PH")} eggs`;

  const saleIdMap = (() => {
    const sorted = [...records].sort((a, b) => {
      const da = new Date(a.dateOfSale || 0).getTime();
      const db = new Date(b.dateOfSale || 0).getTime();
      if (da !== db) return da - db;
      return String(a._id).localeCompare(String(b._id));
    });
    const map = new Map();
    sorted.forEach((r, i) => map.set(r._id, `SL-${String(i + 1).padStart(6, "0")}`));
    return map;
  })();

  const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
  const sortAccessor = (row, col) => {
    if (col === "saleId") return saleIdMap.get(row._id) || "";
    if (col === "dateOfSale") return row.dateOfSale || "";
    if (col === "buyer") return row.buyer || "";
    if (col === "eggSizes") return summarizeSizes(row.items);
    if (col === "totalEggs") return Number(row.totalEggs) || 0;
    if (col === "grandTotal") return Number(row.grandTotal) || 0;
    return "";
  };
  const sorted = sortData(filtered, sortAccessor);
  const pager = usePagination(sorted.length);
  useEffect(() => { pager.setPage(1); }, [search, filterApplied, filters]);
  const pageRows = sorted.slice(pager.startIndex, pager.endIndex);

  const STAT_SPAN_LABELS = { all: "All Records", today: "Today", week: "Weekly", month: "Monthly", year: "Yearly", custom: "Custom Range" };
  const statSpanLabel = STAT_SPAN_LABELS[filterApplied ? filters.period : "all"] || "All Records";

  const periodLabel = (() => {
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

  const exportMeta = {
    farmName: farmInfo.farmName,
    location: farmInfo.farmLocation,
    contact: farmInfo.farmContact,
    email: farmInfo.farmEmail,
    logoUrl: farmInfo.farmLogo
      ? (farmInfo.farmLogo.startsWith("http") ? farmInfo.farmLogo : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${farmInfo.farmLogo}`)
      : "",
    period: periodLabel,
    fields: [
      ...(filterApplied && filters.eggSize !== "All" ? [{ label: "Egg Size", value: filters.eggSize }] : []),
    ],
  };

  const exportRows = filtered.map((r) => ({
    saleId: saleIdMap.get(r._id) || "—",
    dateOfSale: r.dateOfSale ? new Date(r.dateOfSale).toISOString().split("T")[0] : "—",
    buyer: r.buyer || "—",
    eggSizes: summarizeSizes(r.items),
    totalEggs: formatEggs(r.totalEggs),
    grandTotal: formatPeso(r.grandTotal),
    remarks: r.remarks || "—",
  }));
  const exportColumns = [
    { key: "saleId", label: "Sale ID" },
    { key: "dateOfSale", label: "Date of Sale" },
    { key: "buyer", label: "Buyer / Customer" },
    { key: "eggSizes", label: "Egg Sizes" },
    { key: "totalEggs", label: "Total Eggs" },
    { key: "grandTotal", label: "Grand Total" },
    { key: "remarks", label: "Remarks" },
  ];

  const exportSummary = filtered.length
    ? [
        { label: "Total Transactions", value: String(liveStats.totalSalesRecords) },
        { label: "Total Eggs Sold", value: formatEggs(liveStats.totalEggsSold) },
        { label: "Gross Sales", value: formatPeso(liveStats.totalRevenue) },
      ]
    : [];

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "SALES AND TRANSACTIONS", path: "/sales-transactions" },
        { label: "SALES RECORD" },
      ]}
    >
        {}
        <div className="sr-toolbar">
          <button className="add-sales-btn" onClick={() => navigate("/sales-transactions/sales/add")}>
            <FiPlus />{" "}{tr("Add Sales Record")}</button>

          <div className="sr-toolbar-actions">
            <div className="sr-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder={tr("Search Sales...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="sr-btn-group">
              {isOwner && (
                <button type="button" className="sr-toolbar-btn sr-pricing-btn" onClick={openPricing} aria-haspopup="dialog">
                  <FiTag />{" "}{tr("Egg Pricing")}
                </button>
              )}
              <div className="sr-filter-wrap" ref={filterRef}>
                <button className="sr-toolbar-btn" onClick={openFilterPanel}>
                  <FiFilter />{" "}{tr("Filter")}{activeFilterCount > 0 && <span className="sr-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="sr-filter-dropdown">
                    <div className="sr-filter-dropdown-header">
                      <span>{tr("Filter Records")}</span>
                    </div>

                    <div className="sr-filter-section-label">{tr("Date Filter")}</div>
                    <div className="sr-filter-row">
                      <div className="sr-filter-group">
                        <label className="sr-filter-label">{tr("Date Period")}</label>
                        <select
                          className="sr-filter-select"
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
                        <div className="sr-filter-group">
                          <label className="sr-filter-label">{tr("Week")}</label>
                          <input
                            type="week"
                            className="sr-filter-select"
                            value={draft.week}
                            onChange={(e) => handleFilterChange("week", e.target.value)}
                          />
                        </div>
                      )}

                      {draft.period === "month" && (
                        <div className="sr-filter-group">
                          <label className="sr-filter-label">{tr("Month")}</label>
                          <select
                            className="sr-filter-select"
                            value={draft.month}
                            onChange={(e) => handleFilterChange("month", e.target.value)}
                          >
                            <option value="All">{tr("Select Month")}</option>
                            {monthOptions.map((opt) => (
                              <option key={opt} value={opt}>{tr(opt)}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {(draft.period === "month" || draft.period === "year") && (
                        <div className="sr-filter-group">
                          <label className="sr-filter-label">{tr("Year")}</label>
                          <select
                            className="sr-filter-select"
                            value={draft.year}
                            onChange={(e) => handleFilterChange("year", e.target.value)}
                          >
                            <option value="All">{tr("Select Year")}</option>
                            {yearOptions.map((opt) => (
                              <option key={opt} value={opt}>{tr(opt)}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {draft.period === "custom" && (
                      <div className="sr-filter-group">
                        <label className="sr-filter-label">{tr("Start Date / End Date")}</label>
                        <div className="sr-filter-date-range">
                          <input type="date" className="sr-filter-select" value={draft.dateFrom}
                            max={draft.dateTo || todayStr()}
                            onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label={tr("From date")} />
                          <span>{tr("to")}</span>
                          <input type="date" className="sr-filter-select" value={draft.dateTo}
                            min={draft.dateFrom || undefined} max={todayStr()}
                            onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label={tr("To date")} />
                        </div>
                      </div>
                    )}

                    <div className="sr-filter-section-label">{tr("Filters")}</div>
                    <div className="sr-filter-row">
                      <div className="sr-filter-group">
                        <label className="sr-filter-label">{tr("Egg Size")}</label>
                        <select
                          className="sr-filter-select"
                          value={draft.eggSize}
                          onChange={(e) => handleFilterChange("eggSize", e.target.value)}
                        >
                          <option value="All">{tr("All Sizes")}</option>
                          {eggSizeOptions.map((opt) => (
                            <option key={opt} value={opt}>{tr(opt)}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="sr-filter-actions">
                      <button className="sr-filter-clear" onClick={clearFilters}>{tr("Clear All")}</button>
                      <button className="sr-filter-apply" onClick={applyFilters}>{tr("Apply")}</button>
                    </div>
                  </div>
                )}
              </div>

              <ExportMenu
                rows={exportRows}
                columns={exportColumns}
                name="sales-record"
                title={tr("Sales Performance Report")}
                meta={exportMeta}
                pdfExtra={{ period: exportMeta.period, summary: exportSummary, hideApprovalAndTagline: true }}
                moduleLabel="Sales Record"
                enablePreview
                filters={{
                  ...(filterApplied && filters.eggSize !== "All" ? { "Egg Size": filters.eggSize } : {}),
                  ...(filterApplied && filters.period !== "all" ? { "Report Period": periodLabel } : {}),
                }}
                className="sr-toolbar-btn"
              />
            </div>
          </div>
        </div>

        {}

        {}
        <div className="sr-stats-grid">
          <div className="sr-stat-card">
            <div className="sr-stat-icon green"><FiDollarSign /></div>
            <div>
              <h3>{formatPeso(liveStats.totalRevenue)}</h3>
              <p>{tr("Total Revenue")}</p>
              <span>{statSpanLabel}</span>
            </div>
          </div>

          <div className="sr-stat-card">
            <div className="sr-stat-icon blue"><FiTrendingUp /></div>
            <div>
              <h3>{formatEggs(liveStats.totalEggsSold)}</h3>
              <p>{tr("Total Eggs Sold")}</p>
              <span>{statSpanLabel}</span>
            </div>
          </div>
        </div>

        {}
        {error && <div className="sr-error-banner">{error}</div>}

        {}
        <TableSection className="sr-table-wrapper">
          <TableScroll>
          {loading ? (
            <div className="sr-loading">{tr("Loading sales records...")}</div>
          ) : (
            <table className="sr-table">
              <thead>
                <tr>
                  <th className="sr-sortable-th" onClick={() => cycleSort("saleId")}>{tr("Sale ID")}{sortIndicator("saleId", sortColumn, sortDirection)}</th>
                  <th className="sr-sortable-th" onClick={() => cycleSort("dateOfSale")}>{tr("Date of Sale")}{sortIndicator("dateOfSale", sortColumn, sortDirection)}</th>
                  <th className="sr-sortable-th" onClick={() => cycleSort("buyer")}>{tr("Buyer / Customer")}{sortIndicator("buyer", sortColumn, sortDirection)}</th>
                  <th>{tr("Egg Sizes")}</th>
                  <th className="sr-sortable-th" onClick={() => cycleSort("totalEggs")}>{tr("Total Eggs")}{sortIndicator("totalEggs", sortColumn, sortDirection)}</th>
                  <th className="sr-sortable-th" onClick={() => cycleSort("grandTotal")}>{tr("Grand Total")}{sortIndicator("grandTotal", sortColumn, sortDirection)}</th>
                  <th>{tr("Remarks")}</th>
                  <th>{tr("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="sr-empty-state">
                      <div className="sr-empty-content">
                        <FiMaximize />
                        <h3>{tr("No sales records found")}</h3>
                        <p>{tr("Click Add Sales Record to log your first egg sale transaction.")}</p>
                        <button
                          className="sr-empty-add-btn"
                          onClick={() => navigate("/sales-transactions/sales/add")}
                        >
                          <FiPlus />{" "}{tr("Add Sales Record")}</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={r._id}>
                      <td><span className="sr-badge" title={r.saleId}>{saleIdMap.get(r._id) || "—"}</span></td>
                      <td>{r.dateOfSale ? new Date(r.dateOfSale).toISOString().split("T")[0] : ""}</td>
                      <td>{r.buyer}</td>
                      <td>{summarizeSizes(r.items)}</td>
                      <td>{formatEggs(r.totalEggs)}</td>
                      <td className="sr-total">{formatPeso(r.grandTotal)}</td>
                      <td className="sr-notes">{r.remarks || "—"}</td>
                      <td>
                        <div className="sr-action-buttons">
                          {canEdit && (
                            <button className="sr-action-btn edit" title={tr("Edit")} onClick={() => navigate(`/sales-transactions/sales/edit/${r._id}`)}>
                              <FiEdit2 />
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
      {pricingOpen && isOwner && (
        <div className="poc-overlay" onClick={closePricing}>
          <div
            className="poc-modal sr-pricing-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sr-pricing-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="poc-head">
              <h3 id="sr-pricing-title"><FiTag /> {tr("Egg Pricing")}</h3>
              <button className="poc-close" onClick={closePricing} aria-label={tr("Close")} disabled={pricingSaving}><FiX /></button>
            </div>

            <div className="poc-body">
              <p className="sr-pricing-intro">
                {tr("Set the selling price per egg for each size. New sales fill in the Unit Price automatically when an egg size is chosen. Past sales keep their own prices.")}
              </p>

              {pricingLoading ? (
                <p className="sr-pricing-status">{tr("Loading…")}</p>
              ) : (
                <div className="sr-pricing-list">
                  {EGG_SIZES.map((size) => {
                    const rowError = pricingRowError(pricingDraft[size]);
                    const id = `sr-price-${size.replace(/\s+/g, "-").toLowerCase()}`;
                    return (
                      <div className={`sr-pricing-row${rowError ? " invalid" : ""}`} key={size}>
                        <label htmlFor={id}>{tr(size)}</label>
                        <div className="sr-pricing-input">
                          <span className="sr-pricing-prefix">₱</span>
                          <input
                            id={id}
                            type="text"
                            inputMode="decimal"
                            value={pricingDraft[size] ?? ""}
                            placeholder={tr("Not set")}
                            onChange={(e) => { setPricingDraft((d) => ({ ...d, [size]: sanitizeDecimal(e.target.value) })); setPricingSaved(false); setPricingError(""); }}
                            onBlur={() => setPricingDraft((d) => {
                              const v = String(d[size] ?? "").trim();
                              return PRICE_2DP.test(v) ? { ...d, [size]: priceText(v) } : d;
                            })}
                            aria-invalid={rowError ? true : undefined}
                            aria-describedby={rowError ? `${id}-error` : undefined}
                          />
                          <span className="sr-pricing-unit">{tr("per egg")}</span>
                        </div>
                        {rowError && <span className="sr-pricing-error" id={`${id}-error`}>{rowError}</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="sr-pricing-hint">{tr("Leave a size blank if you don't sell it — it can't be added to a sale until a price is set.")}</p>
              {pricingMeta.updatedAt && (
                <p className="sr-pricing-meta">
                  {tr("Last updated")}{" "}{new Date(pricingMeta.updatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}
                  {pricingMeta.updatedBy ? ` · ${pricingMeta.updatedBy}` : ""}
                </p>
              )}
              {pricingError && <p className="sr-pricing-error banner" role="alert">{pricingError}</p>}
              {pricingSaved && <p className="sr-pricing-saved" role="status">{tr("Egg prices saved.")}</p>}
            </div>

            <div className="poc-foot">
              <button type="button" className="poc-btn-cancel" onClick={closePricing} disabled={pricingSaving}>{tr("Close")}</button>
              <button
                type="button"
                className="poc-btn-save sr-pricing-save"
                onClick={savePricing}
                disabled={pricingLoading || pricingSaving || pricingHasErrors}
              >
                <FiSave /> {pricingSaving ? tr("Saving...") : tr("Save Prices")}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}