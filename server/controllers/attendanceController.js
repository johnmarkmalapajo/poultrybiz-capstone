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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let attendance = await Attendance.findOne({
      personnel: personnel._id,
      date: today,
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