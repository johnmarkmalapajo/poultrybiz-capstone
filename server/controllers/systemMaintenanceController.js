const SystemMaintenance = require("../models/SystemMaintenance");
const { createAuditLog } = require("./auditController");

// =====================================================
// GET STATUS (public — no auth required)
// =====================================================
// Called by both the API-level lockout (maintenanceGate middleware)
// and the frontend gate (MaintenanceGate.jsx) before a user has even
// logged in, so this must not require a token. Returns whichever
// window matters right now: the currently-active one, or — if none —
// the soonest upcoming one (so the banner can show a countdown).
exports.getMaintenanceStatus = async (req, res) => {
  try {
    const now = new Date();

    const active = await SystemMaintenance.findOne({
      cancelled: false,
      startTime: { $lte: now },
      endTime: { $gte: now },
    }).sort({ startTime: -1 });

    if (active) {
      return res.status(200).json({
        success: true,
        active: true,
        upcoming: false,
        window: active,
      });
    }

    const upcoming = await SystemMaintenance.findOne({
      cancelled: false,
      startTime: { $gt: now },
    }).sort({ startTime: 1 });

    return res.status(200).json({
      success: true,
      active: false,
      upcoming: !!upcoming,
      window: upcoming || null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// =====================================================
// LIST (SuperAdmin only) — history + upcoming, for the management UI
// =====================================================
exports.listMaintenance = async (req, res) => {
  try {
    const records = await SystemMaintenance.find({}).sort({ startTime: -1 }).limit(50);
    return res.status(200).json({ success: true, records });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// =====================================================
// SCHEDULE (SuperAdmin only)
// =====================================================
exports.scheduleMaintenance = async (req, res) => {
  try {
    const { startTime, endTime, message } = req.body;

    if (!startTime || !endTime) {
      return res.status(400).json({ success: false, message: "Start and end time are required." });
    }
    if (new Date(endTime) <= new Date(startTime)) {
      return res.status(400).json({ success: false, message: "End time must be after start time." });
    }

    const record = await SystemMaintenance.create({
      startTime,
      endTime,
      message: message || undefined, // falls through to the model default if blank
      createdBy: req.user.id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "System Maintenance",
      action: "Scheduled",
      description: `Scheduled system maintenance from ${new Date(startTime).toLocaleString()} to ${new Date(endTime).toLocaleString()}.`,
    });

    return res.status(201).json({ success: true, message: "Maintenance window scheduled.", record });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// =====================================================
// UPDATE (SuperAdmin only) — only makes sense before it has started
// =====================================================
exports.updateMaintenance = async (req, res) => {
  try {
    const record = await SystemMaintenance.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: "Maintenance window not found." });
    }
    if (record.startTime <= new Date()) {
      return res.status(400).json({ success: false, message: "Can't edit a window that has already started." });
    }

    const { startTime, endTime, message } = req.body;
    if (startTime) record.startTime = startTime;
    if (endTime) record.endTime = endTime;
    if (message !== undefined) record.message = message;

    if (new Date(record.endTime) <= new Date(record.startTime)) {
      return res.status(400).json({ success: false, message: "End time must be after start time." });
    }

    await record.save();

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "System Maintenance",
      action: "Edited",
      description: `Updated scheduled maintenance window (${new Date(record.startTime).toLocaleString()} – ${new Date(record.endTime).toLocaleString()}).`,
    });

    return res.status(200).json({ success: true, record });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// =====================================================
// CANCEL (SuperAdmin only)
// =====================================================
exports.cancelMaintenance = async (req, res) => {
  try {
    const record = await SystemMaintenance.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: "Maintenance window not found." });
    }

    record.cancelled = true;
    await record.save();

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "System Maintenance",
      action: "Cancelled",
      description: `Cancelled scheduled maintenance window (${new Date(record.startTime).toLocaleString()} – ${new Date(record.endTime).toLocaleString()}).`,
    });

    return res.status(200).json({ success: true, message: "Maintenance window cancelled.", record });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};