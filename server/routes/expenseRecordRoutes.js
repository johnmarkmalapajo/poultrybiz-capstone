const express = require("express");
const router = express.Router();

const {
  createExpenseRecord,
  getExpenseRecords,
  getArchivedExpenseRecords,
  getExpenseRecord,
  updateExpenseRecord,
  restoreExpenseRecord,
  deleteExpenseRecord,
  uploadReceipt,
} = require("../controllers/expenseRecordController");

const { protect } = require("../middleware/authMiddleware");
const uploadReceiptMiddleware = require("../middleware/receiptUpload");

router.get("/", protect, getExpenseRecords);
router.get("/archived", protect, getArchivedExpenseRecords);
router.get("/:id", protect, getExpenseRecord);

router.post("/", protect, createExpenseRecord);
router.post(
  "/upload-receipt",
  protect,
  uploadReceiptMiddleware.single("receipt"),
  uploadReceipt
);

router.put("/:id", protect, updateExpenseRecord);
router.put("/:id/restore", protect, restoreExpenseRecord);

router.delete("/:id", protect, deleteExpenseRecord);

module.exports = router;