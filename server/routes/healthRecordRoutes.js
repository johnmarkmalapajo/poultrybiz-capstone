const express = require("express");

const {
  createHealthRecord,
  getAllHealthRecords,
  getHealthRecordById,
  updateHealthRecord,
  deleteHealthRecord,
  archiveHealthRecord,
  restoreHealthRecord,
  getArchivedHealthRecords,
} = require("../controllers/healthRecordController");

const {
  protect,
  ownerOnly,
  recordEditor,
} = require("../middleware/authMiddleware");
const { preventDuplicateSubmission } = require("../middleware/duplicateGuard");

const router = express.Router();

router.get("/", protect, getAllHealthRecords);

router.get(
  "/archived",
  protect,
  ownerOnly,
  getArchivedHealthRecords
);

router.get(
  "/:id",
  protect,
  getHealthRecordById
);

router.post(
  "/",
  protect,
  recordEditor,
  preventDuplicateSubmission,
  createHealthRecord
);

router.put(
  "/:id",
  protect,
  recordEditor,
  updateHealthRecord
);

router.delete(
  "/:id",
  protect,
  ownerOnly,
  deleteHealthRecord
);

router.patch(
  "/:id/archive",
  protect,
  ownerOnly,
  archiveHealthRecord
);

router.patch(
  "/:id/restore",
  protect,
  ownerOnly,
  restoreHealthRecord
);

module.exports = router;