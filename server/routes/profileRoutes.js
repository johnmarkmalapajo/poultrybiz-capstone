const express = require("express");
const router = express.Router();

const {
  getMyProfile,
  updateMyProfile,
  changePassword,
  uploadAvatar,
  getFarmInfo,
  uploadFarmLogo,
  getAvatarImage,
  getFarmLogoImage,
  updateTextSize,
} = require("../controllers/profileController");

const { protect, ownerOnly } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const uploadFarmLogoMiddleware = require("../middleware/farmLogoUpload");

// Runs multer and turns its errors (wrong type, too large, extra files) into
// a 400 with a clear message instead of a generic 500. Nothing is saved
// when it fails, so the current picture / logo stays.
const singleImage = (uploader, field) => (req, res, next) => {
  uploader.single(field)(req, res, (err) => {
    if (!err) return next();
    let message = err.message || "Upload failed.";
    if (err.code === "LIMIT_FILE_SIZE") {
      message = `Image must be ${Math.round(upload.MAX_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`;
    } else if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
      message = "Upload one image at a time.";
    }
    return res.status(400).json({ success: false, message });
  });
};

router.get("/", protect, getMyProfile);

router.put("/", protect, updateMyProfile);

router.put("/text-size", protect, updateTextSize);

router.get("/farm", protect, getFarmInfo);

// Stored images (public so <img> tags and exports can load them; they
// return only the image itself).
router.get("/avatar/:userId", getAvatarImage);
router.get("/farm-logo", getFarmLogoImage);

router.post(
  "/change-password",
  protect,
  changePassword
);

router.post(
  "/upload-avatar",
  protect,
  singleImage(upload, "avatar"),
  uploadAvatar
);

router.post(
  "/upload-farm-logo",
  protect,
  ownerOnly,
  singleImage(uploadFarmLogoMiddleware, "logo"),
  uploadFarmLogo
);

module.exports = router;