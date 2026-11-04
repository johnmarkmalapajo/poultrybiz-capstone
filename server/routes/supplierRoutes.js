const express = require("express");
const router = express.Router();

const { listSuppliers, createSupplier } = require("../controllers/supplierController");
const { protect, ownerOnly } = require("../middleware/authMiddleware");
const { preventDuplicateSubmission } = require("../middleware/duplicateGuard");

router.get("/", protect, listSuppliers);
router.post("/", protect, ownerOnly, preventDuplicateSubmission, createSupplier);

module.exports = router;