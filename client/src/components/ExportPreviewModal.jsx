import { useState, useRef } from "react";
import { FiX, FiZoomIn, FiZoomOut, FiDownload, FiFileText, FiRepeat } from "react-icons/fi";
import { buildReportBodyHtml, buildMultiSectionReportBodyHtml, getReportStyles, getMultiSectionExtraStyles } from "../exportTable";
import "./ExportPreviewModal.css";

/**
 * Export Preview Modal — shared component, per Reporting & Export
 * Implementation Specification Chapter 17-18-20.
 *
 * Renders the EXACT same markup that exportPdf() would print (same
 * buildReportBodyHtml/getReportStyles helpers), inside an isolated
 * iframe, so what the user previews is guaranteed to match the final
 * PDF (Chapter 18: "The Preview shall accurately represent the final
 * exported document.").
 *
 * This is an opt-in component — it does not run unless a page
 * explicitly renders it (see ExportMenu.jsx's `enablePreview` prop).
 * Pages that don't use it are completely unaffected.
 *
 * Single-table mode (existing pages):
 *   <ExportPreviewModal
 *     open={previewOpen}
 *     onClose={() => setPreviewOpen(false)}
 *     headers={headers} data={data} title={title}
 *     exportedBy={exportedBy} meta={meta} extra={pdfExtra}
 *     onDownloadPdf={() => ...} onDownloadExcel={() => ...}
 *   />
 *
 * Multi-section mode (e.g. a Personnel's Attendance + Personal Tasks +
 * Assigned Tasks combined into one report) — pass `sections` instead
 * of `headers`/`data`. `onDownloadExcel` is optional; the Excel button
 * only renders when a handler is passed, so a PDF-only report (like
 * Personnel's) doesn't show it:
 *   <ExportPreviewModal
 *     open={previewOpen} onClose={...}
 *     sections={sections} title={title}
 *     exportedBy={exportedBy} meta={meta}
 *     onDownloadPdf={() => ...}
 *   />
 */
export default function ExportPreviewModal({
  open,
  onClose,
  headers,
  data,
  sections,
  title,
  exportedBy,
  meta,
  extra = {},
  onDownloadPdf,
  onDownloadExcel,
}) {
  const [zoom, setZoom] = useState(1);
  const [orientation, setOrientation] = useState("portrait");
  const iframeWrapRef = useRef(null);

  if (!open) return null;

  const isMultiSection = Array.isArray(sections);
  const bodyHtml = isMultiSection
    ? buildMultiSectionReportBodyHtml(sections, title, exportedBy, meta, extra)
    : buildReportBodyHtml(headers || [], data || [], title, exportedBy, meta, extra);
  const extraStyles = isMultiSection ? getMultiSectionExtraStyles() : "";
  const doc = `<!doctype html><html><head><meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${getReportStyles(orientation)} ${extraStyles} body{margin:0;padding:24px 28px;background:#fff}</style>
    </head><body>${bodyHtml}</body></html>`;

  const zoomIn = () => setZoom((z) => Math.min(z + 0.15, 2));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.15, 0.5));
  const toggleOrientation = () => setOrientation((o) => (o === "portrait" ? "landscape" : "portrait"));

  return (
    <div className="xpm-overlay" onClick={onClose}>
      <div className="xpm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="xpm-header">
          <div className="xpm-header-title">
            <FiFileText />
            <span>Export Preview</span>
          </div>
          <div className="xpm-header-actions">
            <button
              className="xpm-orientation-btn"
              onClick={toggleOrientation}
              title={`Switch to ${orientation === "portrait" ? "Landscape" : "Portrait"}`}
              aria-label="Toggle page orientation"
            >
              <FiRepeat /> <span>{orientation === "portrait" ? "Portrait" : "Landscape"}</span>
            </button>
            <button className="xpm-zoom-btn" onClick={zoomOut} title="Zoom out" aria-label="Zoom out"><FiZoomOut /></button>
            <span className="xpm-zoom-level">{Math.round(zoom * 100)}%</span>
            <button className="xpm-zoom-btn" onClick={zoomIn} title="Zoom in" aria-label="Zoom in"><FiZoomIn /></button>
            <button className="xpm-close-btn" onClick={onClose} title="Close" aria-label="Close"><FiX /></button>
          </div>
        </div>

        <div className="xpm-body" ref={iframeWrapRef}>
          <div className={`xpm-page ${orientation === "landscape" ? "xpm-page-landscape" : ""}`} style={{ transform: `scale(${zoom})` }}>
            <iframe
              title="Report preview"
              srcDoc={doc}
              className="xpm-iframe"
              sandbox=""
            />
          </div>
        </div>

        <div className="xpm-footer">
          <button className="xpm-btn xpm-btn-cancel" onClick={onClose}>Cancel</button>
          {onDownloadExcel && (
            <button className="xpm-btn xpm-btn-excel" onClick={onDownloadExcel}><FiDownload /> Download Excel</button>
          )}
          <button className="xpm-btn xpm-btn-pdf" onClick={() => onDownloadPdf(orientation)}><FiDownload /> Download PDF</button>
        </div>
      </div>
    </div>
  );
}