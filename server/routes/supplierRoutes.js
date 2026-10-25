const express = require("express");
const router = express.Router();

const { listSuppliers, createSupplier } = require("../controllers/supplierController");
const { protect, ownerOnly } = require("../middleware/authMiddleware");

router.get("/", protect, listSuppliers);
router.post("/", protect, ownerOnly, createSupplier);

module.exports = router;