const express = require("express");
const router = express.Router();

const { listBreeds, createBreed } = require("../controllers/breedController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, listBreeds);
router.post("/", protect, createBreed);

module.exports = router;