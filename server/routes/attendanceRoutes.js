const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { checkAttendance } = require("../controllers/attendanceController");

router.post("/check", protect, checkAttendance);

module.exports = router;