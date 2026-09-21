const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

const {
  createWasteRecord,
  getAllWasteRecords,
  getWasteRecord,
  updateWasteRecord,
  archiveWasteRecord,
  restoreWasteRecord,
  deleteWasteRecord,
} = require("../controllers/wasteRecordController");

// GET
router.get("/", getAllWasteRecords);
router.get("/:id", getWasteRecord);

// CREATE
router.post("/", protect, createWasteRecord);

// UPDATE
router.put("/:id", protect, updateWasteRecord);

// DELETE
router.delete("/:id", protect, deleteWasteRecord);

// ARCHIVE
router.put("/:id/archive", protect, archiveWasteRecord);

// RESTORE
router.put("/:id/restore", protect, restoreWasteRecord);

module.exports = router;