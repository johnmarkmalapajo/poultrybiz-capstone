const express = require("express");
const router = express.Router();

const { listSuppliers, createSupplier } = require("../controllers/supplierController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, listSuppliers);
router.post("/", protect, createSupplier);

module.exports = router;