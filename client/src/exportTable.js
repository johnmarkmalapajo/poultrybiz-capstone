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

/* Shared report styling — used by both the print window (exportPdf) and
   the Export Preview modal, so the preview always matches the PDF
   exactly (Chapter 18: "The Preview shall accurately represent the
   final exported document."). */
export function getReportStyles(orientation = "portrait") {
  return `
      *{font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      @page{margin:28px 32px;size:${orientation === "landscape" ? "landscape" : "portrait"}}
      h2{color:#47321C;margin:14px 0 10px;font-size:19px}
      .meta-header{display:flex;align-items:flex-start;flex-wrap:wrap;gap:12px 20px}
      .meta-logo{width:52px;height:52px;object-fit:cover;border-radius:8px;border:1px solid #e0d9c8;flex-shrink:0}
      .meta-logo-placeholder{display:flex;align-items:center;justify-content:center;background:#f4f0e6;color:#c9c2b3;font-weight:800;font-size:14px;letter-spacing:0.5px}
      .meta-brand{display:flex;flex-direction:column;justify-content:center;min-width:160px}
      .meta-farm-name{font-size:14px;font-weight:800;color:#47321C}
      .meta-farm-loc{font-size:12px;font-weight:600;color:#8a8478;margin-top:1px}
      .meta-farm-contact{font-size:11px;color:#a39e94;margin-top:1px}
      .info-strip{display:flex;flex-wrap:wrap;gap:4px 22px;font-size:11.5px;color:#555;margin:10px 0 12px;padding-bottom:10px;border-bottom:1px solid #ece7dc}
      .info-strip strong{color:#47321C}
      .meta-fields{display:flex;flex-wrap:wrap;gap:4px 24px;font-size:12.5px;color:#333;padding:10px 14px;background:#faf8f3;border:1px solid #e0d9c8;border-radius:6px;margin-bottom:14px}
      .meta-fields strong{color:#47321C}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#E4AF1F;color:#fff;text-align:left;padding:9px 8px;border:1px solid #e0d9c8}
      td{padding:8px;border:1px solid #ececec;color:#222}
      tr:nth-child(even) td{background:#faf8f3}
      .summary-section{margin-top:18px;padding:12px 16px;background:#fdf9ee;border:1px solid #e8dcb8;border-radius:8px}
      .summary-title{font-size:13px;font-weight:800;color:#47321C;margin-bottom:8px}
      .summary-grid{display:flex;flex-wrap:wrap;gap:8px 28px}
      .summary-item{display:flex;flex-direction:column;min-width:120px}
      .summary-label{font-size:11px;color:#8a8478}
      .summary-value{font-size:14px;font-weight:800;color:#47321C}
      .sign-row{display:flex;justify-content:space-between;margin-top:50px;gap:40px}
      .sign-block{flex:1;font-size:12px;color:#333}
      .sig-line-wrap{display:inline-block}
      .sig-line{border-top:1px solid #333;margin-bottom:6px;padding-top:2px}
      .footer-brand{margin-top:34px;padding-top:10px;border-top:1px solid #ece7dc;text-align:center;font-size:10.5px;color:#a39e94;line-height:1.5}
      .page-num:after{content:"Page " counter(page) " of " counter(pages);font-size:10px;color:#a39e94}
  `;
}

/* Builds the report BODY markup (everything the Preview shows and the
   PDF prints) — Header -> Title -> Info Strip -> Fields -> Table ->
   Summary -> Footer, per the Global Report Layout (Chapter 19). Shared
   by exportPdf() and the Export Preview modal so they can never drift
   apart. */
export function buildReportBodyHtml(headers, data, title, exportedBy, meta, extra = {}) {
  const { period = "", summary = null, hideApprovalAndTagline = false } = extra;
  const now = new Date();

  const metaBlock = meta
    ? `<div class="meta-header">
        ${meta.logoUrl
          ? `<img class="meta-logo" src="${safe(meta.logoUrl)}" alt="Farm logo" />`
          : `<div class="meta-logo meta-logo-placeholder" aria-label="No farm logo set">PB</div>`}
        <div class="meta-brand">
          <div class="meta-farm-name">${meta.farmName ? safe(meta.farmName) : "Not Configured"}</div>
          <div class="meta-farm-loc">${meta.location ? safe(meta.location) : "Not Configured"}</div>
          ${(meta.contact || meta.email) ? `<div class="meta-farm-contact">${[meta.contact, meta.email].filter(Boolean).map(safe).join(" &bull; ")}</div>` : ""}
        </div>
      </div>`
    : "";

  const infoStrip = `<div class="info-strip">
      ${period ? `<div><strong>Report Period:</strong> ${safe(period)}</div>` : ""}
      ${hideApprovalAndTagline ? "" : `<div><strong>Generated By:</strong> ${safe(exportedBy?.name || "Unknown")}${exportedBy?.role ? ` (${safe(exportedBy.role)})` : ""}</div>`}
      <div><strong>Generated Date:</strong> ${safe(now.toLocaleDateString())}</div>
      <div><strong>Generated Time:</strong> ${safe(now.toLocaleTimeString())}</div>
    </div>`;

  const fieldsBlock = (meta?.fields || []).length
    ? `<div class="meta-fields">
        ${meta.fields.map((f) => `<div><strong>${safe(f.label)}:</strong> ${safe(f.value)}</div>`).join("")}
      </div>`
    : "";

  const summaryBlock = (summary && summary.length)
    ? `<div class="summary-section">
        <div class="summary-title">Summary</div>
        <div class="summary-grid">
          ${summary.map((s) => `<div class="summary-item"><span class="summary-label">${safe(s.label)}</span><span class="summary-value">${safe(s.value)}</span></div>`).join("")}
        </div>
      </div>`
    : "";

  return `
      ${metaBlock}
      <h2>${safe(title)}</h2>
      ${infoStrip}
      ${fieldsBlock}
      <table><thead><tr>${headers.map((h) => `<th>${safe(h)}</th>`).join("")}</tr></thead>
      <tbody>${data.map((r) => `<tr>${r.map((c) => `<td>${safe(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
      ${summaryBlock}
      <div class="sign-row">
        <div class="sign-block"><div class="sig-line-wrap"><div class="sig-line"></div>Prepared By${exportedBy?.name ? `: ${safe(exportedBy.name)}${exportedBy.role ? ` (${safe(exportedBy.role)})` : ""}` : ""}</div></div>
        ${hideApprovalAndTagline ? "" : `<div class="sign-block"><div class="sig-line-wrap"><div class="sig-line"></div>Approved By</div></div>`}
      </div>
      ${hideApprovalAndTagline ? "" : `<div class="footer-brand">
        Generated by PoultryBiz<br />
        Integrated Inventory, Sales, Expense and Poultry Farm Management System
      </div>`}
  `;
}

/* Extra styles only the multi-section layout needs, on top of the
   shared getReportStyles() -- kept separate so single-table reports
   don't carry unused CSS. */
export function getMultiSectionExtraStyles() {
  return `
      .section-block{margin-top:22px}
      .section-title{font-size:14px;font-weight:800;color:#47321C;margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid #E4AF1F}
      .section-empty{font-size:12px;color:#a39e94;padding:10px 0}
  `;
}

/* Builds the multi-section report BODY markup -- same header/info-strip/
   fields/footer as buildReportBodyHtml, but several titled tables
   instead of one. Shared by exportMultiSectionPdf() and the Export
   Preview modal so they can never drift apart (same reasoning as
   buildReportBodyHtml above).

   sections: [{ title: "Attendance", headers: [...], rows: [[...], ...] }, ...]
   A section with no rows renders a small "No records" note instead of
   an empty table, rather than being silently skipped. */
export function buildMultiSectionReportBodyHtml(sections, title, exportedBy, meta, extra = {}) {
  const { period = "" } = extra;
  const now = new Date();

  const metaBlock = meta
    ? `<div class="meta-header">
        ${meta.logoUrl
          ? `<img class="meta-logo" src="${safe(meta.logoUrl)}" alt="Farm logo" />`
          : `<div class="meta-logo meta-logo-placeholder" aria-label="No farm logo set">PB</div>`}
        <div class="meta-brand">
          <div class="meta-farm-name">${meta.farmName ? safe(meta.farmName) : "Not Configured"}</div>
          <div class="meta-farm-loc">${meta.location ? safe(meta.location) : "Not Configured"}</div>
        </div>
      </div>`
    : "";

  const infoStrip = `<div class="info-strip">
      ${period ? `<div><strong>Report Period:</strong> ${safe(period)}</div>` : ""}
      <div><strong>Generated By:</strong> ${safe(exportedBy?.name || "Unknown")}${exportedBy?.role ? ` (${safe(exportedBy.role)})` : ""}</div>
      <div><strong>Generated Date:</strong> ${safe(now.toLocaleDateString())}</div>
      <div><strong>Generated Time:</strong> ${safe(now.toLocaleTimeString())}</div>
    </div>`;

  const fieldsBlock = (meta?.fields || []).length
    ? `<div class="meta-fields">
        ${meta.fields.map((f) => `<div><strong>${safe(f.label)}:</strong> ${safe(f.value)}</div>`).join("")}
      </div>`
    : "";

  const sectionsHtml = sections.map((s) => `
    <div class="section-block">
      <div class="section-title">${safe(s.title)}</div>
      ${s.rows && s.rows.length
        ? `<table><thead><tr>${s.headers.map((h) => `<th>${safe(h)}</th>`).join("")}</tr></thead>
           <tbody>${s.rows.map((r) => `<tr>${r.map((c) => `<td>${safe(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`
        : `<div class="section-empty">No records.</div>`}
    </div>
  `).join("");

  return `
      ${metaBlock}
      <h2>${safe(title)}</h2>
      ${infoStrip}
      ${fieldsBlock}
      ${sectionsHtml}
      <div class="sign-row">
        <div class="sign-block"><div class="sig-line-wrap"><div class="sig-line"></div>Prepared By${exportedBy?.name ? `: ${safe(exportedBy.name)}${exportedBy.role ? ` (${safe(exportedBy.role)})` : ""}` : ""}</div></div>
        <div class="sign-block"><div class="sig-line-wrap"><div class="sig-line"></div>Approved By</div></div>
      </div>
      <div class="footer-brand">
        Generated by PoultryBiz<br />
        Integrated Inventory, Sales, Expense and Poultry Farm Management System
      </div>
  `;
}

/* PDF — opens a styled print window; user chooses "Save as PDF" (no library)
   Matches the "Global Report Generation Standard": Farm branding header
   (never PoultryBiz's own logo as primary branding — that only appears
   in the footer), a common info strip, a module-specific summary
   section, and a Prepared By / Approved By footer.

   `meta` (optional) — farm branding + record-specific fields:
     {
       farmName, location, contact, email, logoUrl,
       fields: [{ label: "Breed of Layers", value: "Lohmann White" }, ...],
     }

   `extra` (optional) — the rest of the standard:
     {
       period: "September 2025",              // Report Period
       summary: [{ label: "Total Good Eggs", value: "3,050" }, ...],
     } */
export function exportPdf(filename, headers, data, title = "PoultryBiz Report", exportedBy = null, meta = null, extra = {}, orientation = "portrait") {
  if (!data || !data.length) { alert("No data to export."); return; }
  const win = window.open("", "_blank");
  if (!win) { alert("Please allow pop-ups to export as PDF."); return; }

  const body = buildReportBodyHtml(headers, data, title, exportedBy, meta, extra);

  win.document.write(
    `<html><head><title>${safe(title)}</title><style>${getReportStyles(orientation)}</style></head><body>
      ${body}
      <script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>
    </body></html>`
  );
  win.document.close();
}

/* Multi-section PDF — same header/footer/branding as exportPdf, but
   supports several titled tables in one document instead of just one.
   Used for reports combining multiple record types, e.g. a Personnel's
   full workload history (Info + Attendance + Tasks) in a single export.

   sections: [{ title: "Attendance", headers: [...], rows: [[...], ...] }, ...]
   A section with no rows renders a small "No records" note instead of
   an empty table, rather than being silently skipped. */
export function exportMultiSectionPdf(filename, sections, title = "PoultryBiz Report", exportedBy = null, meta = null, extra = {}) {
  if (!sections || !sections.length) { alert("No data to export."); return; }
  const win = window.open("", "_blank");
  if (!win) { alert("Please allow pop-ups to export as PDF."); return; }

  const body = buildMultiSectionReportBodyHtml(sections, title, exportedBy, meta, extra);

  win.document.write(
    `<html><head><title>${safe(title)}</title><style>${getReportStyles()} ${getMultiSectionExtraStyles()}</style></head><body>
      ${body}
      <script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>
    </body></html>`
  );
  win.document.close();
}

export default { exportCsvTable, exportExcel, exportPdf, exportMultiSectionPdf, buildReportBodyHtml, buildMultiSectionReportBodyHtml, getReportStyles, getMultiSectionExtraStyles };