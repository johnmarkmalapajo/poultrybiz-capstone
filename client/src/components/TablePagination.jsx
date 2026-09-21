// TablePagination.jsx — shared pagination control for any table.
// Pairs with the usePagination hook. Renders nothing if there's nothing
// to paginate (0 records), matching the existing empty-state pattern.

// Builds a windowed page-number list: always shows the first and last
// page, the current page, and one neighbor on each side — collapsing
// any gap into a single "…" entry instead of listing every page.
function getPageWindow(page, totalPages) {
  const delta = 1; // neighbors to show on each side of the current page
  const range = [];
  const withDots = [];
  let last;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      range.push(i);
    }
  }

  for (const i of range) {
    if (last) {
      if (i - last === 2) {
        withDots.push(last + 1);
      } else if (i - last > 2) {
        withDots.push("…");
      }
    }
    withDots.push(i);
    last = i;
  }

  return withDots;
}

export default function TablePagination({ page, setPage, rowsPerPage, setRowsPerPage, totalPages, startIndex, endIndex, totalItems }) {
  if (!totalItems) return null;

  const pageNumbers = getPageWindow(page, totalPages);

  return (
    <div className="tp-pagination">
      <span className="tp-summary">
        Showing {startIndex + 1}–{endIndex} of {totalItems} records
      </span>

      <div className="tp-controls">
        <label className="tp-rows-label">
          Rows per page:
          <select
            className="tp-rows-select"
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>

        <button
          className="tp-nav-btn"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>

        <div className="tp-page-numbers">
          {pageNumbers.map((p, i) =>
            p === "…" ? (
              <span key={`dots-${i}`} className="tp-page-dots">…</span>
            ) : (
              <button
                key={p}
                className={`tp-page-btn ${p === page ? "active" : ""}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button
          className="tp-nav-btn"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}