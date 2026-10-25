const express = require("express");
const router = express.Router();

const { listBreeds, createBreed } = require("../controllers/breedController");
const { protect, ownerOnly } = require("../middleware/authMiddleware");

router.get("/", protect, listBreeds);
router.post("/", protect, ownerOnly, createBreed);

module.exports = router;