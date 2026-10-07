const express = require("express");
const router = express.Router();

const { logReportExport } = require("../controllers/reportController");
const { protect, ownerOnly } = require("../middleware/authMiddleware");

router.post("/log-export", protect, ownerOnly, logReportExport);

module.exports = router;