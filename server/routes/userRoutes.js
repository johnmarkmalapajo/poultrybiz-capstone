const express = require("express");

const {
  getAllUsers,
  getPendingUsers,
  approveUser,
  rejectUser,
  activateUser,
  deactivateUser,
  archiveUser,
  restoreUser,
  getArchivedUsers,
  deleteUserPermanently,
} = require("../controllers/userController");

const {
  protect,
  ownerOnly,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/all-users", protect, ownerOnly, getAllUsers);

router.get("/pending-users", protect, ownerOnly, getPendingUsers);

router.put("/approve/:id", protect, ownerOnly, approveUser);

router.put("/reject/:id", protect, ownerOnly, rejectUser);

router.patch("/:id/activate", protect, ownerOnly, activateUser);

router.patch("/:id/deactivate", protect, ownerOnly, deactivateUser);

router.patch("/:id/archive", protect, ownerOnly, archiveUser);

router.patch("/:id/restore", protect, ownerOnly, restoreUser);

router.get("/archived-users", protect, ownerOnly, getArchivedUsers);

router.delete("/:id/permanent", protect, ownerOnly, deleteUserPermanently);

module.exports = router;