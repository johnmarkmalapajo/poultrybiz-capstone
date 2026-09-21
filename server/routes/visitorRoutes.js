const express = require("express");
const router = express.Router();

const {
  registerVisitor,
  getVisitors,
  getVisitor,
  getVisitorLogs,
  archiveVisitor,
  restoreVisitor,
  deleteVisitor,
} = require("../controllers/visitorController");

const { protect, ownerOnly } = require("../middleware/authMiddleware");

router.get("/", getVisitors);

router.get("/:id", getVisitor);

router.get("/:id/logs", getVisitorLogs);

router.post("/register", registerVisitor);

router.put("/:id/archive", protect, ownerOnly, archiveVisitor);

router.put("/:id/restore", protect, ownerOnly, restoreVisitor);

router.delete("/:id", protect, ownerOnly, deleteVisitor);

module.exports = router;