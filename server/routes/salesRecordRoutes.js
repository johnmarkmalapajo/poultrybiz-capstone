const express = require("express");
const router = express.Router();

const {
  createSalesRecord,
  getSalesRecords,
  getSalesRecord,
  updateSalesRecord,
  restoreSalesRecord,
  deleteSalesRecord,
  getEggStockSummary,
} = require("../controllers/salesRecordController");

const { protect, ownerOnly } = require("../middleware/authMiddleware");

router.get("/", protect, ownerOnly, getSalesRecords);

router.get("/egg-stock", protect, ownerOnly, getEggStockSummary);

router.get("/:id", protect, ownerOnly, getSalesRecord);

router.post("/", protect, ownerOnly, createSalesRecord);

router.put("/:id", protect, ownerOnly, updateSalesRecord);

router.put("/:id/restore", protect, ownerOnly, restoreSalesRecord);

router.delete("/:id", protect, ownerOnly, deleteSalesRecord);

module.exports = router;