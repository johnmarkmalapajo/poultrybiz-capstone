const express = require("express");
const router = express.Router();

const { listVeterinarians } = require("../controllers/healthOptionController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, listVeterinarians);

module.exports = router;