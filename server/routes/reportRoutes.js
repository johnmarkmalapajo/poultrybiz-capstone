const express = require("express");
const router = express.Router();

const { logReportExport } = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware");

router.post("/log-export", protect, logReportExport);

module.exports = router;