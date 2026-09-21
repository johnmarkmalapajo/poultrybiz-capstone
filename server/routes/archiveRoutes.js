const express = require("express");
const router = express.Router();

const {
  getArchivedRecords,
  deleteArchiveEntry,
} = require("../controllers/archiveController");

const { protect, ownerOnly } = require("../middleware/authMiddleware");

router.get("/", protect, getArchivedRecords);

router.delete("/:id", protect, ownerOnly, deleteArchiveEntry);

module.exports = router;