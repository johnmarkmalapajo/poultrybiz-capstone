// controllers/reportController.js
//
// Per "AUDIT LOG STANDARD FOR REPORT EXPORT": every successful report
// export (PDF or Excel) must create an Audit Log entry — date/time,
// user, role, module, report title, action, format, and the applied
// filter values. The generated file itself is never stored — only this
// activity metadata, for auditing purposes.

const { createAuditLog } = require("./auditController");
const { canExportModule } = require("../utils/exportPermissions");

// POST /api/v1/reports/log-export
exports.logReportExport = async (req, res) => {
  try {
    const { module, reportTitle, format, filters } = req.body;

    if (!module || !reportTitle || !format) {
      return res.status(400).json({
        success: false,
        message: "module, reportTitle, and format are required.",
      });
    }

    // Role-Based Export Permission System — never trust the frontend
    // alone; a Farmer calling this endpoint directly for a module they
    // aren't authorized to export (Personnel, Visitors, Sales, Expenses,
    // Users & Roles, Audit Logs, etc.) is rejected here regardless of
    // what the UI would have shown them.
    if (!canExportModule(req.user.role, module)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to export this report.",
      });
    }

    const filterText = filters && Object.keys(filters).length
      ? ` (Filters: ${Object.entries(filters).map(([k, v]) => `${k}: ${v}`).join(", ")})`
      : "";

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module,
      action: format === "Excel" ? "Export Excel" : "Export PDF",
      description: `Exported "${reportTitle}" as ${format}${filterText}.`,
    });

    res.json({
      success: true,
      message: "Export logged.",
    });
  } catch (err) {
    console.error("Log Report Export Error:", err);
    // Never block the actual download over a logging failure.
    res.status(200).json({
      success: false,
      message: "Export succeeded but the audit log entry could not be saved.",
    });
  }
};