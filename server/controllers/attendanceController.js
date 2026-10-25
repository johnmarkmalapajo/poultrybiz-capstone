const crypto = require("crypto");
const Attendance = require("../models/Attendance");
const Personnel = require("../models/Personnel");
const User = require("../models/User");
const { createAuditLog } = require("./auditController");
const { createNotification } = require("./notificationController");

// A second scan this soon after the previous one is treated as the same
// scan (QR scanned twice, page refreshed, double tap, network retry)
// instead of an immediate check-out.
const DUPLICATE_SCAN_MINUTES = 5;
const DUPLICATE_SCAN_MS = DUPLICATE_SCAN_MINUTES * 60 * 1000;

const formatPhTime = (value) =>
  new Date(value).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  });

const generateQrToken = () => crypto.randomBytes(18).toString("base64url");

// The Owner's official attendance QR code, created the first time it is
// requested. Only the Owner can read it (route uses ownerOnly).
const getOrCreateQrToken = async (ownerId) => {
  const owner = await User.findById(ownerId).select("+attendanceQrToken");
  if (!owner) return null;

  if (!owner.attendanceQrToken) {
    owner.attendanceQrToken = generateQrToken();
    await owner.save();
  }

  return owner.attendanceQrToken;
};

const isOfficialQrToken = async (token) => {
  if (!token || typeof token !== "string" || token.length > 100) return false;

  const owner = await User.findOne({ role: "Owner", attendanceQrToken: token })
    .select("_id")
    .lean();

  return !!owner;
};

exports.getAttendanceQr = async (req, res) => {
  try {
    const token = await getOrCreateQrToken(req.user.id);

    if (!token) {
      return res.status(404).json({
        success: false,
        message: "Owner account not found.",
      });
    }

    return res.json({
      success: true,
      qrToken: token,
      checkInPath: `/attendance/check-in?qr=${encodeURIComponent(token)}`,
    });
  } catch (err) {
    console.error("Attendance QR error:", err);

    return res.status(500).json({
      success: false,
      message: "Couldn't load the attendance QR code.",
    });
  }
};

const personSummary = (req, personnel) => ({
  name: req.user.name,
  role: req.user.role,
  position: personnel.position || "",
});

exports.checkAttendance = async (req, res) => {
  try {
    // Identity always comes from the authenticated session, never from the
    // request body or the QR URL.
    const userId = req.user.id;

    if (!(await isOfficialQrToken(req.body?.qr))) {
      return res.status(400).json({
        success: false,
        code: "INVALID_QR",
        message: "This is not the farm's current attendance QR code. Please scan the official QR code provided by the Owner.",
      });
    }

    const personnel = await Personnel.findOne({ user: userId });

    if (!personnel) {
      return res.status(404).json({
        success: false,
        message: "Personnel record not found.",
      });
    }

    const person = personSummary(req, personnel);

    // "Today" in Philippine time (UTC+8), regardless of the server's clock.
    // The day is stored as UTC-midnight of the PH date (so 2026-10-06 shows as
    // 2026-10-06), and looked up with a PH-day range so records saved under the
    // older convention are still found (no duplicate check-ins).
    const phDate = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const today = new Date(`${phDate}T00:00:00.000Z`);
    const dayStart = new Date(`${phDate}T00:00:00+08:00`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();

    let attendance = await Attendance.findOne({
      personnel: personnel._id,
      date: { $gte: dayStart, $lt: dayEnd },
    }).sort({ createdAt: 1 });

    if (!attendance) {
      const dayKey = `${personnel._id}:${phDate}`;
      let created = false;

      try {
        const result = await Attendance.findOneAndUpdate(
          { dayKey },
          {
            $setOnInsert: {
              personnel: personnel._id,
              user: userId,
              date: today,
              timeIn: now,
              status: "Present",
              dayKey,
            },
          },
          { upsert: true, returnDocument: "after", includeResultMetadata: true }
        );

        attendance = result.value;
        created = !result.lastErrorObject?.updatedExisting;
      } catch (err) {
        // A simultaneous scan inserted the same day first.
        if (err?.code !== 11000) throw err;
        attendance = await Attendance.findOne({ dayKey });
      }

      if (created) {
        await createAuditLog({
          user: req.user.name,
          role: req.user.role,
          module: "Attendance",
          action: "Check In",
          description: `${req.user.name} checked in.`,
        });

        await createNotification({
          title: "Attendance Check-In",
          description: `${req.user.name} (${req.user.role}) checked in at ${formatPhTime(now)}.`,
          category: "personnel",
          type: "alert",
          priority: "Normal",
          roles: ["Owner"],
        });

        return res.json({
          success: true,
          message: "Checked in successfully.",
          action: "check-in",
          person,
          attendance,
        });
      }
    }

    if (!attendance.timeOut) {
      const sinceCheckIn = now - new Date(attendance.timeIn || attendance.createdAt);

      if (sinceCheckIn < DUPLICATE_SCAN_MS) {
        return res.json({
          success: true,
          message: `You already checked in today at ${formatPhTime(attendance.timeIn || attendance.createdAt)}. No new record was created. Scan again after ${DUPLICATE_SCAN_MINUTES} minutes to check out.`,
          action: "already-checked-in",
          person,
          attendance,
        });
      }

      // Only one request can set timeOut.
      const checkedOut = await Attendance.findOneAndUpdate(
        { _id: attendance._id, timeOut: null },
        { $set: { timeOut: now } },
        { returnDocument: "after" }
      );

      if (checkedOut) {
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
          person,
          attendance: checkedOut,
        });
      }

      attendance = await Attendance.findById(attendance._id);
    }

    if (attendance.timeOut && now - new Date(attendance.timeOut) < DUPLICATE_SCAN_MS) {
      return res.json({
        success: true,
        message: `You already checked out today at ${formatPhTime(attendance.timeOut)}. No new record was created.`,
        action: "already-checked-out",
        person,
        attendance,
      });
    }

    return res.status(400).json({
      success: false,
      code: "ATTENDANCE_COMPLETED",
      message: "Attendance for today is already completed.",
      person,
      attendance,
    });
  } catch (err) {
    console.error("Attendance check error:", err);

    res.status(500).json({
      success: false,
      message: "Couldn't record your attendance. Please try again.",
    });
  }
};