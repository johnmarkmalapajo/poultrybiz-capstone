const express = require("express");
const router = express.Router();

const {
  createEggRecord,
  getAllEggRecords,
  getEggRecordById,
  updateEggRecord,
  deleteEggRecord,
  archiveEggRecord,
  restoreEggRecord,
} = require("../controllers/eggRecordController");

const {
  protect,
  ownerOnly,
  recordEditor,
} = require("../middleware/authMiddleware");

router.get(
  "/",
  protect,
  getAllEggRecords
);

router.get(
  "/:id",
  protect,
  getEggRecordById
);

router.post(
  "/",
  protect,
  recordEditor,
  createEggRecord
);

router.put(
  "/:id",
  protect,
  recordEditor,
  updateEggRecord
);

router.delete(
  "/:id",
  protect,
  ownerOnly,
  deleteEggRecord
);

router.patch(
  "/:id/archive",
  protect,
  ownerOnly,
  archiveEggRecord
);

router.patch(
  "/:id/restore",
  protect,
  ownerOnly,
  restoreEggRecord
);

module.exports = router;