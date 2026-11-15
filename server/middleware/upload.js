const multer = require("multer");

// Image uploads for the Profile Picture and the Farm Logo.
//
// The file is kept in MEMORY only (never written to the server's disk): the
// controller validates it and stores the bytes in MongoDB, which is the
// app's permanent storage. Render's filesystem is temporary -- it is wiped on
// every redeploy / restart / spin-down -- so images saved under uploads/
// vanished while the database still pointed at them.
//
// Only raster image types a browser can show safely are accepted (no SVG,
// which can carry scripts). The controller additionally checks the file's
// real content (magic bytes), so a renamed non-image is rejected too.
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error("Only JPG, PNG, WEBP or GIF images are allowed.");
    err.status = 400;
    cb(err, false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
  },
});

upload.ALLOWED_TYPES = ALLOWED_TYPES;
upload.MAX_IMAGE_BYTES = MAX_IMAGE_BYTES;

module.exports = upload;