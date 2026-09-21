const express = require("express");
const router = express.Router();

const { getDashboardSummary } = require("../controllers/dashboardController");
const { protect } = require("../middleware/authMiddleware");

/*
|--------------------------------------------------------------------------
| DASHBOARD ROUTES
|--------------------------------------------------------------------------
| GET / — role-scoped summary (stat cards + charts) for the logged-in user.
| Any authenticated role may call it; the controller itself decides which
| fields (e.g. financials) that role is allowed to see.
*/
router.get("/", protect, getDashboardSummary);

module.exports = router;
