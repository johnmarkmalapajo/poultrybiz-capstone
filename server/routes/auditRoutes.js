const express = require("express");
const router = express.Router();

const { protect, ownerOnly } = require("../middleware/authMiddleware");

const {
  getAuditLogs,
} = require("../controllers/auditController");

router.get("/", protect, ownerOnly, getAuditLogs);

module.exports = router;