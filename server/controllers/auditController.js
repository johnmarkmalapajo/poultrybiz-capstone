const AuditLog = require("../models/AuditLog");

// ======================================
// GET ALL AUDIT LOGS
// ======================================
exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      records: logs,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to load audit logs.",
    });
  }
};

// ======================================
// CREATE AUDIT LOG
// (Reusable by other controllers)
// ======================================
exports.createAuditLog = async ({
  user = "System",
  role = "System",
  module,
  action,
  description,
  prev = null,
  next = null,
}) => {
  try {
    const log = await AuditLog.create({
      user,
      role,
      module,
      action,
      description,
      prev,
      next,
    });

    console.log("Audit Log Saved:", log._id);

  } catch (err) {
    console.error("===== AUDIT LOG ERROR =====");
    console.error(err);
    throw err;
  }
};