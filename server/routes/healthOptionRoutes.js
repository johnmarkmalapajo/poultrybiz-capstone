const express = require("express");
const router = express.Router();

const { listHealthOptions } = require("../controllers/healthOptionController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, listHealthOptions);

module.exports = router;