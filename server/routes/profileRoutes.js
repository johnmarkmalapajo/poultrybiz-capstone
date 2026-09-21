const express = require("express");
const router = express.Router();

const {
  getMyProfile,
  updateMyProfile,
  changePassword,
  uploadAvatar,
  getFarmInfo,
  uploadFarmLogo,
} = require("../controllers/profileController");

const { protect, ownerOnly } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const uploadFarmLogoMiddleware = require("../middleware/farmLogoUpload");

router.get("/", protect, getMyProfile);

router.put("/", protect, updateMyProfile);

router.get("/farm", protect, getFarmInfo);

router.post(
  "/change-password",
  protect,
  changePassword
);

router.post(
  "/upload-avatar",
  protect,
  upload.single("avatar"),
  uploadAvatar
);

router.post(
  "/upload-farm-logo",
  protect,
  ownerOnly,
  uploadFarmLogoMiddleware.single("logo"),
  uploadFarmLogo
);

module.exports = router;