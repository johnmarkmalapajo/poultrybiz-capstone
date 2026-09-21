const express = require("express");
const router = express.Router();

const { checkDependencies } = require("../controllers/dependencyController");
const { protect } = require("../middleware/authMiddleware");

// GET /api/v1/dependencies/:type/:id
// type is one of: user, personnel, flock (see dependencyController.js)
router.get("/:type/:id", protect, checkDependencies);

module.exports = router;
