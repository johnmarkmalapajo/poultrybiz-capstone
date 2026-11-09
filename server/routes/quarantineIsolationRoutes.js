const express = require("express");
const router = express.Router();

const { protect, recordEditor } = require("../middleware/authMiddleware");

const {
  createQuarantineRecord,
  getAllQuarantineRecords,
  getQuarantineRecord,
  updateQuarantineRecord,
  updateIsolationProgress,
  correctIsolationProgress,
  releaseQuarantineRecord,
  archiveQuarantineRecord,
  restoreQuarantineRecord,
  deleteQuarantineRecord,
} = require("../controllers/quarantineIsolationController");
const { preventDuplicateSubmission } = require("../middleware/duplicateGuard");

// GET
router.get("/", protect, getAllQuarantineRecords);
router.get("/:id", protect, getQuarantineRecord);

// CREATE
router.post("/", protect, preventDuplicateSubmission, createQuarantineRecord);

// UPDATE
router.put("/:id", protect, updateQuarantineRecord);
router.patch("/:id/progress", protect, updateIsolationProgress);
router.patch("/:id/release", protect, recordEditor, releaseQuarantineRecord);
router.patch("/:id/progress/:updateId", protect, correctIsolationProgress);

// DELETE
router.delete("/:id", protect, deleteQuarantineRecord);

// ARCHIVE
router.put("/:id/archive", protect, archiveQuarantineRecord);

// RESTORE
router.put("/:id/restore", protect, restoreQuarantineRecord);

module.exports = router;