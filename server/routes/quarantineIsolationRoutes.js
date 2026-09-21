const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

const {
  createQuarantineRecord,
  getAllQuarantineRecords,
  getQuarantineRecord,
  updateQuarantineRecord,
  updateQuarantineStatus,
  updateIsolationProgress,
  correctIsolationProgress,
  archiveQuarantineRecord,
  restoreQuarantineRecord,
  deleteQuarantineRecord,
} = require("../controllers/quarantineIsolationController");

// GET
router.get("/", getAllQuarantineRecords);
router.get("/:id", getQuarantineRecord);

// CREATE
router.post("/", protect, createQuarantineRecord);

// UPDATE
router.put("/:id", protect, updateQuarantineRecord);
router.patch("/:id/status", protect, updateQuarantineStatus);
router.patch("/:id/progress", protect, updateIsolationProgress);
router.patch("/:id/progress/:updateId", protect, correctIsolationProgress);

// DELETE
router.delete("/:id", protect, deleteQuarantineRecord);

// ARCHIVE
router.put("/:id/archive", protect, archiveQuarantineRecord);

// RESTORE
router.put("/:id/restore", protect, restoreQuarantineRecord);

module.exports = router;