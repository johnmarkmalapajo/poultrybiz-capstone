// exportUtils.js — frontend-only CSV export. Place at: src/exportUtils.js
//
// Wired to each page's Export button:
//   import { exportTableToCSV } from "../exportUtils";
//   <button ... onClick={() => exportTableToCSV("egg-records")}>Export</button>
//
// It reads whatever the table is currently showing (respects search + filters),
// skips the "Actions" column, and downloads a .csv — no backend needed.

function downloadBlob(content, name, type = "text/csv;charset=utf-8;") {
  const blob = new Blob(["\uFEFF" + content], { type }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const esc = (s) => `"${String(s ?? "").replace(/"/g, '""').replace(/\s+/g, " ").trim()}"`;

/* Export the visible table on the page (what the user currently sees). */
export function exportTableToCSV(filename = "export", tableEl) {
  const table =
    tableEl ||
    document.querySelector("main table") ||
    document.querySelector("[class$='-main'] table") ||
    document.querySelector("table");
  if (!table) { alert("No table found to export on this page."); return; }

  const headerCells = [...table.querySelectorAll("thead th")];
  const skip = new Set();
  headerCells.forEach((th, i) => {
    const t = (th.innerText || "").trim().toLowerCase();
    if (!t || /^actions?$/.test(t) || t === "done" || t === "select") skip.add(i);
  });

  const keep = headerCells.map((_, i) => i).filter((i) => !skip.has(i));
  const headers = keep.map((i) => esc(headerCells[i].innerText)).join(",");

  const rows = [...table.querySelectorAll("tbody tr")]
    .map((tr) => {
      const cells = [...tr.children];
      // skip empty-state rows (single colSpan cell)
      if (cells.length <= 1) return null;
      return keep.map((i) => esc(cells[i] ? cells[i].innerText : "")).join(",");
    })
    .filter(Boolean);

  if (!rows.length) { alert("No records available to export. Add records first or clear the filters."); return; }

  const csv = [headers, ...rows].join("\r\n");
  downloadBlob(csv, `${filename}-${new Date().toISOString().slice(0, 10)}.csv`);
}

/* Export an array of objects directly (if you'd rather pass data than read the DOM). */
export function exportToCSV(filename = "export", rows = []) {
  if (!rows.length) { alert("No records available to export."); return; }
  const flat = (o, p = "", out = {}) => {
    Object.entries(o || {}).forEach(([k, v]) => {
      const key = p ? `${p}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) flat(v, key, out);
      else out[key] = Array.isArray(v) ? v.join("; ") : v;
    });
    return out;
  };
  const flatRows = rows.map((r) => flat(r));
  const cols = [...new Set(flatRows.flatMap((r) => Object.keys(r)))].filter((c) => !/^(_id|__v|password)$/i.test(c));
  const csv = [
    cols.map(esc).join(","),
    ...flatRows.map((r) => cols.map((c) => esc(r[c])).join(",")),
  ].join("\r\n");
  downloadBlob(csv, `${filename}-${new Date().toISOString().slice(0, 10)}.csv`);
}

export default exportTableToCSV;
