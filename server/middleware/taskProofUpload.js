const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Mirrors middleware/receiptUpload.js's established disk-storage pattern so
// the new Task Proof-of-Completion upload reuses the same conventions
// (dedicated uploads/<thing> directory, timestamp+random filename, type and
// size filtering) rather than inventing a new one.
const uploadDir = path.join(__dirname, "..", "uploads", "tasks");

const storage = multer.diskStorage({
  destination(req, file, cb) {
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },

  filename(req, file, cb) {
    const ext = path.extname(file.originalname);

    cb(
      null,
      `taskproof-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`
    );
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed for Photo Proof of Completion."), false);
  }
};

const uploadTaskProof = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = uploadTaskProof;