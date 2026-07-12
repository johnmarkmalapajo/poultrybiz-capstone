// exportTable.js — frontend-only export to CSV / Excel / PDF (no libraries).
// Takes headers: string[] and data: (string|number)[][].
// Place at: src/exportTable.js
//   import { exportCsvTable, exportExcel, exportPdf } from "../exportTable";

const stamp = () => new Date().toISOString().slice(0, 10);
const safe = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function download(content, name, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* CSV — opens in Excel/Sheets */
export function exportCsvTable(filename, headers, data) {
  if (!data || !data.length) { alert("No data to export."); return; }
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...data].map((r) => r.map(q).join(",")).join("\r\n");
  download("\uFEFF" + csv, `${filename}-${stamp()}.csv`, "text/csv;charset=utf-8;");
}

/* Excel — HTML-table .xls (opens natively in Microsoft Excel, no library) */
export function exportExcel(filename, headers, data) {
  if (!data || !data.length) { alert("No data to export."); return; }
  const html =
    `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>` +
    `<table border="1"><thead><tr>${headers.map((h) => `<th>${safe(h)}</th>`).join("")}</tr></thead>` +
    `<tbody>${data.map((r) => `<tr>${r.map((c) => `<td>${safe(c)}</td>`).join("")}</tr>`).join("")}</tbody>` +
    `</table></body></html>`;
  download(html, `${filename}-${stamp()}.xls`, "application/vnd.ms-excel");
}

/* PDF — opens a styled print window; user chooses "Save as PDF" (no library) */
export function exportPdf(filename, headers, data, title = "PoultryBiz Report") {
  if (!data || !data.length) { alert("No data to export."); return; }
  const win = window.open("", "_blank");
  if (!win) { alert("Please allow pop-ups to export as PDF."); return; }
  win.document.write(
    `<html><head><title>${safe(title)}</title><style>
      *{font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      h2{color:#47321C;margin:0 0 2px;font-size:20px}
      .sub{color:#999;font-size:12px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#E4AF1F;color:#fff;text-align:left;padding:9px 8px;border:1px solid #e0d9c8}
      td{padding:8px;border:1px solid #ececec;color:#222}
      tr:nth-child(even) td{background:#faf8f3}
    </style></head><body>
      <h2>${safe(title)}</h2>
      <div class="sub">PoultryBiz &bull; Generated ${new Date().toLocaleString()}</div>
      <table><thead><tr>${headers.map((h) => `<th>${safe(h)}</th>`).join("")}</tr></thead>
      <tbody>${data.map((r) => `<tr>${r.map((c) => `<td>${safe(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>
    </body></html>`
  );
  win.document.close();
}

export default { exportCsvTable, exportExcel, exportPdf };
