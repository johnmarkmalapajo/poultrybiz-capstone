const Attendance = require("../models/Attendance");
const Personnel = require("../models/Personnel");
const { createAuditLog } = require("./auditController");
const { createNotification } = require("./notificationController");

exports.checkAttendance = async (req, res) => {
  try {
    const userId = req.user.id;

    const personnel = await Personnel.findOne({ user: userId });

    if (!personnel) {
      return res.status(404).json({
        success: false,
        message: "Personnel record not found.",
      });
    }

    // "Today" in Philippine time (UTC+8), regardless of the server's clock.
    // The day is stored as UTC-midnight of the PH date (so 2026-10-06 shows as
    // 2026-10-06), and looked up with a PH-day range so records saved under the
    // older convention are still found (no duplicate check-ins).
    const phDate = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const today = new Date(`${phDate}T00:00:00.000Z`);
    const dayStart = new Date(`${phDate}T00:00:00+08:00`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    let attendance = await Attendance.findOne({
      personnel: personnel._id,
      date: { $gte: dayStart, $lt: dayEnd },
    });

    if (!attendance) {
      attendance = await Attendance.create({
        personnel: personnel._id,
        user: userId,
        date: today,
        timeIn: new Date(),
        status: "Present",
      });

      await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Attendance",
        action: "Check In",
        description: `${req.user.name} checked in.`,
      });

      await createNotification({
        title: "Attendance Check-In",
        description: `${req.user.name} (${req.user.role}) checked in at ${new Date().toLocaleTimeString()}.`,
        category: "personnel",
        type: "alert",
        priority: "Normal",
        roles: ["Owner"],
      });

      return res.json({
        success: true,
        message: "Checked in successfully.",
        action: "check-in",
        attendance,
      });
    }

    if (!attendance.timeOut) {
      attendance.timeOut = new Date();
      await attendance.save();

      await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Attendance",
        action: "Check Out",
        description: `${req.user.name} checked out.`,
      });

      return res.json({
        success: true,
        message: "Checked out successfully.",
        action: "check-out",
        attendance,
      });
    }

    return res.status(400).json({
      success: false,
      message: "Attendance for today is already completed.",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};