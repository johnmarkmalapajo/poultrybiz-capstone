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

const { protect, ownerOnly } = require("../middleware/authMiddleware");
const uploadReceiptMiddleware = require("../middleware/receiptUpload");

router.get("/", protect, ownerOnly, getExpenseRecords);
router.get("/archived", protect, ownerOnly, getArchivedExpenseRecords);
router.get("/:id", protect, ownerOnly, getExpenseRecord);

router.post("/", protect, ownerOnly, createExpenseRecord);
router.post(
  "/upload-receipt",
  protect,
  ownerOnly,
  uploadReceiptMiddleware.single("receipt"),
  uploadReceipt
);

router.put("/:id", protect, ownerOnly, updateExpenseRecord);
router.put("/:id/restore", protect, ownerOnly, restoreExpenseRecord);

router.delete("/:id", protect, ownerOnly, deleteExpenseRecord);

module.exports = router;