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
  getEggPrices,
  updateEggPrices,
} = require("../controllers/salesRecordController");

const { protect, ownerOnly } = require("../middleware/authMiddleware");
const { preventDuplicateSubmission } = require("../middleware/duplicateGuard");

router.get("/", protect, ownerOnly, getSalesRecords);

router.get("/egg-stock", protect, ownerOnly, getEggStockSummary);

// Egg Pricing (Owner only) -- before "/:id" so it isn't read as a record id.
router.get("/egg-prices", protect, ownerOnly, getEggPrices);
router.put("/egg-prices", protect, ownerOnly, updateEggPrices);

router.get("/:id", protect, ownerOnly, getSalesRecord);

router.post("/", protect, ownerOnly, preventDuplicateSubmission, createSalesRecord);

router.put("/:id", protect, ownerOnly, updateSalesRecord);

router.put("/:id/restore", protect, ownerOnly, restoreSalesRecord);

router.delete("/:id", protect, ownerOnly, deleteSalesRecord);

module.exports = router;