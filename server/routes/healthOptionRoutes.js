const express = require("express");
const router = express.Router();

const { listHealthOptions, createHealthOption } = require("../controllers/healthOptionController");
const { protect, recordEditor } = require("../middleware/authMiddleware");

router.get("/", protect, listHealthOptions);
// Only for the categories the controller allows (e.g. Equipment
// Location/Storage); same users who can add / edit Equipment records. A
// repeated submission is answered by the controller's duplicate check
// ("already exists") and the unique index, so no extra guard is needed.
router.post("/", protect, recordEditor, createHealthOption);

module.exports = router;