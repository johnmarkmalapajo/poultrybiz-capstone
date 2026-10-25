const express = require("express");
const router = express.Router();

const { protect, ownerOnly } = require("../middleware/authMiddleware");
const { checkAttendance, getAttendanceQr } = require("../controllers/attendanceController");

// Official attendance QR code -- Owner only.
router.get("/qr", protect, ownerOnly, getAttendanceQr);

// Record attendance for the logged-in account (identity from the session).
router.post("/check", protect, checkAttendance);

module.exports = router;