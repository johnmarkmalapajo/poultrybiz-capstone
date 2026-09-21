const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

const {
  createManureRecord,
  getAllManureRecords,
  getManureRecord,
  updateManureRecord,
  archiveManureRecord,
  restoreManureRecord,
  deleteManureRecord,
} = require("../controllers/manureRecordController");

// GET
router.get("/", getAllManureRecords);
router.get("/:id", getManureRecord);

// CREATE
router.post("/", protect, createManureRecord);

// UPDATE
router.put("/:id", protect, updateManureRecord);

// DELETE
router.delete("/:id", protect, deleteManureRecord);

// ARCHIVE
router.put("/:id/archive", protect, archiveManureRecord);

// RESTORE
router.put("/:id/restore", protect, restoreManureRecord);

module.exports = router;