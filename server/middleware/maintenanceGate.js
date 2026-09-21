const jwt = require("jsonwebtoken");
const SystemMaintenance = require("../models/SystemMaintenance");

const ALWAYS_ALLOWED = [/\/system-maintenance\/status$/, /\/auth\//];

async function maintenanceGate(req, res, next) {
  try {
    if (ALWAYS_ALLOWED.some((re) => re.test(req.originalUrl))) {
      return next();
    }

    const active = await SystemMaintenance.findOne({
      cancelled: false,
      startTime: { $lte: new Date() },
      endTime: { $gte: new Date() },
    }).select("startTime endTime message");

    if (!active) return next();

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
        if (decoded.role === "Owner") return next();
      } catch {
      }
    }

    return res.status(503).json({
      success: false,
      maintenance: true,
      message: active.message,
      window: { startTime: active.startTime, endTime: active.endTime },
    });
  } catch (err) {
    console.error("maintenanceGate error:", err);
    return next();
  }
}

module.exports = { maintenanceGate };