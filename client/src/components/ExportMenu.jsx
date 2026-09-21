import { useState } from "react";
import { FiDownload } from "react-icons/fi";
import { exportExcel, exportPdf } from "../exportTable";
import { useUser } from "../hooks/useUser";
import { logReportExport } from "../api/reports";
import { canExportModule } from "../exportPermissions";
import ExportPreviewModal from "./ExportPreviewModal";

export default function ExportMenu({ rows = [], name = "export", title = "PoultryBiz Report", columns, meta = null, pdfExtra = {}, moduleLabel, filters = {}, enablePreview = false, className = "toolbar-btn" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const { user, role, isOwner } = useUser();
  const exportedBy = { name: user?.name || "Unknown", role: isOwner ? "Owner" : (user?.role || "") };
  const pdfExportedBy = isOwner ? exportedBy : null;

  if (!canExportModule(role, moduleLabel || title)) return null;

  const build = () => {
    if (!rows || !rows.length) return { headers: [], data: [] };
    let cols = columns;
    if (!cols) cols = [...new Set(rows.flatMap((r) => Object.keys(r || {})))].filter((c) => !["_id", "id", "__v"].includes(c));
    const headers = cols.map((c) => (typeof c === "string" ? c : c.label));
    const keys = cols.map((c) => (typeof c === "string" ? c : c.key));
    const val = (r, k) => String(k).split(".").reduce((o, kk) => (o == null ? o : o[kk]), r);
    const data = rows.map((r) =>
      keys.map((k) => {
        const v = val(r, k);
        return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : v;
      })
    );
    return { headers, data };
  };

  const logExport = (kind) => {
    logReportExport({
      module: moduleLabel || title,
      reportTitle: title,
      format: kind === "pdf" ? "PDF" : "Excel",
      filters,
    }).catch(() => {});
  };

  const doExport = (kind) => {
    if (busy) return;
    const { headers, data } = build();
    if (!data.length) { alert("No records available to export."); setOpen(false); return; }

    if (enablePreview && (kind === "pdf" || kind === "excel")) {
      setPreview({ headers, data });
      setOpen(false);
      return;
    }

    setBusy(true);
    try {
      if (kind === "excel") exportExcel(name, headers, data, title);
      else if (kind === "pdf") exportPdf(name, headers, data, title, pdfExportedBy, meta, pdfExtra);

      logExport(kind);
    } finally {
      setOpen(false);
      setTimeout(() => setBusy(false), 600);
    }
  };

  const downloadFromPreview = (kind, orientation = "portrait") => {
    if (!preview) return;
    if (kind === "excel") exportExcel(name, preview.headers, preview.data, title);
    else exportPdf(name, preview.headers, preview.data, title, pdfExportedBy, meta, pdfExtra, orientation);
    logExport(kind);
    setPreview(null);
  };

  const OPTS = [
    { k: "excel", label: "Excel (.xlsx)", ico: "📊" },
    { k: "pdf", label: "PDF", ico: "📄" },
  ];

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button className={className} onClick={() => setOpen((o) => !o)} disabled={busy}>
        <FiDownload /> {busy ? "Exporting…" : "Export ▾"}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 41,
            background: "#fff", border: "1px solid #e4e0d8", borderRadius: 12,
            boxShadow: "0 8px 26px rgba(0,0,0,0.12)", overflow: "hidden", minWidth: 180,
            fontFamily: "Poppins, sans-serif",
          }}>
            {OPTS.map((o) => (
              <button key={o.k} onClick={() => doExport(o.k)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "11px 16px", border: "none", background: "none", cursor: "pointer",
                  fontFamily: "Poppins, sans-serif", fontSize: 13, fontWeight: 600, color: "#47321C", textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fdf3e3")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                <span>{o.ico}</span> {o.label}
              </button>
            ))}
          </div>
        </>
      )}

      {enablePreview && (
        <ExportPreviewModal
          open={!!preview}
          onClose={() => setPreview(null)}
          headers={preview?.headers}
          data={preview?.data}
          title={title}
          exportedBy={pdfExportedBy}
          meta={meta}
          extra={pdfExtra}
          onDownloadPdf={(orientation) => downloadFromPreview("pdf", orientation)}
          onDownloadExcel={() => downloadFromPreview("excel")}
        />
      )}
    </div>
  );
}