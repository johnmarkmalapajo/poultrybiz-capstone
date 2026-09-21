const express = require("express");
const router = express.Router();

const {
  createSalesRecord,
  getSalesRecords,
  getSalesRecord,
  updateSalesRecord,
  archiveSalesRecord,
  restoreSalesRecord,
  deleteSalesRecord,
  getEggStockSummary,
} = require("../controllers/salesRecordController");

const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getSalesRecords);

router.get("/egg-stock", protect, getEggStockSummary);

router.get("/:id", protect, getSalesRecord);

router.post("/", protect, createSalesRecord);

router.put("/:id", protect, updateSalesRecord);

router.put("/:id/archive", protect, archiveSalesRecord);

router.put("/:id/restore", protect, restoreSalesRecord);

router.delete("/:id", protect, deleteSalesRecord);

module.exports = router;