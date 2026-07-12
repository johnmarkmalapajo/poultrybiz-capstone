// exportCsv.js — frontend-only CSV export (no library, works in-browser).
// Place at: src/exportCsv.js
//   import { exportToCsv } from "../exportCsv";
//   exportToCsv("egg-records", filteredRows);

export function exportToCsv(filename, rows) {
  if (!rows || !rows.length) {
    alert("No data to export.");
    return;
  }
  // flatten one level of nested objects (e.g. profile.fullName)
  const flat = rows.map((r) => {
    const o = {};
    for (const k in r) {
      const v = r[k];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        for (const kk in v) o[`${k}.${kk}`] = v[kk];
      } else {
        o[k] = v;
      }
    }
    return o;
  });
  const cols = [...new Set(flat.flatMap((r) => Object.keys(r)))].filter(
    (c) => c !== "_id" && c !== "__v" && c !== "id"
  );
  const esc = (val) => {
    const s = val == null ? "" : String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    cols.join(","),
    ...flat.map((r) => cols.map((c) => esc(r[c])).join(",")),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default exportToCsv;
