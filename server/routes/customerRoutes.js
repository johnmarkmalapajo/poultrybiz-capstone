const express = require("express");
const router = express.Router();

const { listCustomers, createCustomer } = require("../controllers/customerController");
const { protect } = require("../middleware/authMiddleware");
const { preventDuplicateSubmission } = require("../middleware/duplicateGuard");

router.get("/", protect, listCustomers);
router.post("/", protect, preventDuplicateSubmission, createCustomer);

module.exports = router;