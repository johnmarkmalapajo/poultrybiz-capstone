const express = require("express");
const router = express.Router();

const { listBreeds, createBreed } = require("../controllers/breedController");
const { protect, ownerOnly } = require("../middleware/authMiddleware");
const { preventDuplicateSubmission } = require("../middleware/duplicateGuard");

router.get("/", protect, listBreeds);
router.post("/", protect, ownerOnly, preventDuplicateSubmission, createBreed);

module.exports = router;