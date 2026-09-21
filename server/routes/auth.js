const express = require("express");

const {
  login,
  signup,
  logout,
  forgotPassword,
  resetPassword,
  checkFirstAccount,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/first-account-check", checkFirstAccount);
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", protect, logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;