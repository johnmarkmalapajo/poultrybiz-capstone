const express = require("express");

const router = express.Router();

const {
  createMortalityRecord,
  getAllMortalityRecords,
  getMortalityRecordById,
  updateMortalityRecord,
  deleteMortalityRecord,
  archiveMortalityRecord,
  restoreMortalityRecord,
  getArchivedMortalityRecords,
} = require("../controllers/mortalityRecordController");

const {
  protect,
  ownerOnly,
  recordEditor,
} = require("../middleware/authMiddleware");

router.get(
  "/",
  protect,
  getAllMortalityRecords
);

router.get(
  "/archived",
  protect,
  ownerOnly,
  getArchivedMortalityRecords
);

router.get(
  "/:id",
  protect,
  getMortalityRecordById
);

router.post(
  "/",
  protect,
  recordEditor,
  createMortalityRecord
);

router.put(
  "/:id",
  protect,
  recordEditor,
  updateMortalityRecord
);

router.delete(
  "/:id",
  protect,
  ownerOnly,
  deleteMortalityRecord
);

router.patch(
  "/:id/archive",
  protect,
  ownerOnly,
  archiveMortalityRecord
);

router.patch(
  "/:id/restore",
  protect,
  ownerOnly,
  restoreMortalityRecord
);

module.exports = router;