const express = require("express");
const router = express.Router();

const { listCustomers, createCustomer } = require("../controllers/customerController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, listCustomers);
router.post("/", protect, createCustomer);

module.exports = router;