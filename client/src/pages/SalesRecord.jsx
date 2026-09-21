import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload,
  FiEdit2, FiArchive, FiDollarSign,
  FiTrendingUp, FiMaximize,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import ExportMenu from "../components/ExportMenu";
import { useUser } from "../hooks/useUser";
import { archiveRow } from "../archiveRow";
import { useArchiveConfirm } from "../hooks/useArchiveConfirm";
import ArchiveConfirmModal from "../components/ArchiveConfirmModal";
import "./SalesRecord.css";
import { listSalesRecords } from "../api/salesRecord";
import { getFarmInfo } from "../api/profile";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination from "../components/TablePagination";
import "../components/TablePagination.css";

const summarizeSizes = (items) => {
  if (!items || !items.length) return "—";
  const sizes = [...new Set(items.map((i) => i.eggSize))];
  return sizes.length <= 2 ? sizes.join(", ") : `${sizes.slice(0, 2).join(", ")} +${sizes.length - 2} more`;
};

export default function SalesRecord() {
  const navigate = useNavigate();
  const { canEdit, canArchive, user } = useUser();

  const [records, setRecords] = useState([]);
  const [search, setSearch]   = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ eggSize: "All", dateFrom: "", dateTo: "" });
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
        setError(data.message || "Failed to load records.");
      }
    } catch (err) {
      setError(err?.message || "Cannot connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchRecords(search), 400);
    return () => clearTimeout(timer);
  }, [search, fetchRecords]);

  useEffect(() => {
    getFarmInfo().then((d) => setFarmInfo(d)).catch(() => {});
  }, []);

  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({ eggSize: "All", dateFrom: "", dateTo: "" });
  const activeFilterCount = Object.values(filters).filter((v) => v && v !== "All").length;

  useEffect(() => {
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { pending: archivePending, requestArchive, cancelArchive, confirmArchive } =
    useArchiveConfirm(() => fetchRecords(search));

  const handleArchive = (r) => {
    requestArchive({
      module: "Sales Records",
      moduleKey: "pb_sales",
      record: r,
      name: r.buyer || `Sale ${r.dateOfSale || ""}`.trim(),
      user: (user && (user.fullName || user.name)) || "Owner",
    });
  };

  const uniq = (vals) => [...new Set(vals.filter(Boolean))];
  const eggSizeOptions = uniq(records.flatMap((r) => (r.items || []).map((i) => i.eggSize)));

  const filtered = records.filter(
    (r) =>
      (filters.eggSize === "All" || (r.items || []).some((i) => i.eggSize === filters.eggSize)) &&
      (!filters.dateFrom || (r.dateOfSale || "") >= filters.dateFrom) &&
      (!filters.dateTo || (r.dateOfSale || "") <= filters.dateTo)
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
  useEffect(() => { pager.setPage(1); }, [search, filters]);
  const pageRows = sorted.slice(pager.startIndex, pager.endIndex);

  const periodLabel = filters.dateFrom && filters.dateTo
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
      ? (farmInfo.farmLogo.startsWith("http") ? farmInfo.farmLogo : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${farmInfo.farmLogo}`)
      : "",
    period: periodLabel,
    fields: [
      ...(filters.eggSize !== "All" ? [{ label: "Egg Size", value: filters.eggSize }] : []),
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
            <FiPlus /> Add Sales Record
          </button>

          <div className="sr-toolbar-actions">
            <div className="sr-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search Sales..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="sr-btn-group">
              <div className="sr-filter-wrap" ref={filterRef}>
                <button className="sr-toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="sr-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="sr-filter-dropdown">
                    <div className="sr-filter-dropdown-header">
                      <span>Filter Records</span>
                      <button className="sr-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>

                    <div className="sr-filter-group">
                      <label className="sr-filter-label">Egg Size</label>
                      <select
                        className="sr-filter-select"
                        value={filters.eggSize}
                        onChange={(e) => handleFilterChange("eggSize", e.target.value)}
                      >
                        <option value="All">All Sizes</option>
                        {eggSizeOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div className="sr-filter-group">
                      <label className="sr-filter-label">Report Period</label>
                      <div className="sr-filter-date-range">
                        <input type="date" className="sr-filter-select" value={filters.dateFrom}
                          onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label="From date" />
                        <span>to</span>
                        <input type="date" className="sr-filter-select" value={filters.dateTo}
                          onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label="To date" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <ExportMenu
                rows={exportRows}
                columns={exportColumns}
                name="sales-record"
                title="Sales Performance Report"
                meta={exportMeta}
                pdfExtra={{ period: exportMeta.period, summary: exportSummary }}
                moduleLabel="Sales Record"
                enablePreview
                filters={{
                  ...(filters.eggSize !== "All" ? { "Egg Size": filters.eggSize } : {}),
                  ...(periodLabel !== "All Time" ? { "Report Period": periodLabel } : {}),
                }}
                className="sr-toolbar-btn"
              />
            </div>
          </div>
        </div>

        {}
        {activeFilterCount > 0 && (
          <div className="sr-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value && value !== "All" ? (
                <span key={key} className="sr-active-filter-tag">
                  {key === "eggSize" ? "Egg Size" : key === "dateFrom" ? "From" : "To"}: {value}
                  <button onClick={() => handleFilterChange(key, key === "dateFrom" || key === "dateTo" ? "" : "All")}>✕</button>
                </span>
              ) : null
            )}
          </div>
        )}

        {}
        <div className="sr-stats-grid">
          <div className="sr-stat-card">
            <div className="sr-stat-icon green"><FiDollarSign /></div>
            <div>
              <h3>{formatPeso(liveStats.totalRevenue)}</h3>
              <p>Total Revenue</p>
              <span>All Records</span>
            </div>
          </div>

          <div className="sr-stat-card">
            <div className="sr-stat-icon blue"><FiTrendingUp /></div>
            <div>
              <h3>{formatEggs(liveStats.totalEggsSold)}</h3>
              <p>Total Eggs Sold</p>
              <span>All Records</span>
            </div>
          </div>
        </div>

        {}
        {error && <div className="sr-error-banner">{error}</div>}

        {}
        <div className="sr-table-wrapper">
          {loading ? (
            <div className="sr-loading">Loading sales records...</div>
          ) : (
            <table className="sr-table">
              <thead>
                <tr>
                  <th className="sr-sortable-th" onClick={() => cycleSort("saleId")}>Sale ID{sortIndicator("saleId", sortColumn, sortDirection)}</th>
                  <th className="sr-sortable-th" onClick={() => cycleSort("dateOfSale")}>Date of Sale{sortIndicator("dateOfSale", sortColumn, sortDirection)}</th>
                  <th className="sr-sortable-th" onClick={() => cycleSort("buyer")}>Buyer / Customer{sortIndicator("buyer", sortColumn, sortDirection)}</th>
                  <th>Egg Sizes</th>
                  <th className="sr-sortable-th" onClick={() => cycleSort("totalEggs")}>Total Eggs{sortIndicator("totalEggs", sortColumn, sortDirection)}</th>
                  <th className="sr-sortable-th" onClick={() => cycleSort("grandTotal")}>Grand Total{sortIndicator("grandTotal", sortColumn, sortDirection)}</th>
                  <th>Remarks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="sr-empty-state">
                      <div className="sr-empty-content">
                        <FiMaximize />
                        <h3>No sales records found</h3>
                        <p>Click Add Sales Record to log your first egg sale transaction.</p>
                        <button
                          className="sr-empty-add-btn"
                          onClick={() => navigate("/sales-transactions/sales/add")}
                        >
                          <FiPlus /> Add Sales Record
                        </button>
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
                            <button className="sr-action-btn edit" title="Edit" onClick={() => navigate(`/sales-transactions/sales/edit/${r._id}`)}>
                              <FiEdit2 />
                            </button>
                          )}
                          {canArchive && (
                            <button className="sr-action-btn archive" title="Archive" onClick={() => handleArchive(r)}>
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
    </PageLayout>
  );
}