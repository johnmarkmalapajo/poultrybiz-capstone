const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Expense receipts and Proof of Delivery files (POST
// /expense-records/upload-receipt, field "receipt"). Files are saved on disk
// under uploads/receipts and served from /uploads/receipts/<name>.
//
// Accepted: JPG, PNG or PDF, up to 5MB -- the same rule the Add / Edit
// Expense forms show. Both the MIME type and the file extension must match,
// and the controller also checks the file's real content (magic bytes).
//
// Every rejection is a 400 with a message the form can show. Before, multer's
// errors (file too large, wrong type, wrong field) reached the global error
// handler without a status and came back as HTTP 500 "Something went wrong on
// the server.", so the user never learned why the upload failed.

const uploadDir = path.join(__dirname, "..", "uploads", "receipts");

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_RECEIPT_MB = MAX_RECEIPT_BYTES / (1024 * 1024);

// MIME type -> the extensions allowed for it, and the extension saved.
const ALLOWED = {
  "image/jpeg": { exts: [".jpg", ".jpeg"], ext: ".jpg" },
  "image/png": { exts: [".png"], ext: ".png" },
  "application/pdf": { exts: [".pdf"], ext: ".pdf" },
};
const TYPE_MESSAGE = "Only JPG, PNG or PDF files are allowed.";

const badRequest = (message) => Object.assign(new Error(message), { status: 400, expose: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },

  // The saved name never reuses the user's file name; the extension is the
  // one that matches the verified type.
  filename(req, file, cb) {
    const ext = ALLOWED[file.mimetype]?.ext || "";
    cb(null, `receipt-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const rule = ALLOWED[file.mimetype];
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!rule || !rule.exts.includes(ext)) {
    cb(badRequest(TYPE_MESSAGE), false);
    return;
  }
  cb(null, true);
};

const multerUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_RECEIPT_BYTES,
    files: 1,
  },
});

// Turns multer's errors into clear 400 responses; anything else (e.g. the
// disk can't be written) stays a 500 and is logged by the error handler.
function toUploadError(err, field) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return badRequest(`The file is too large. The maximum size is ${MAX_RECEIPT_MB}MB.`);
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE" || err.code === "LIMIT_FILE_COUNT") {
      return badRequest(`Upload one file in the "${field}" field.`);
    }
    return badRequest(`The file could not be uploaded (${err.message}).`);
  }
  return err;
}

// Same call as multer's own: uploadReceipt.single("receipt").
function single(field) {
  const handler = multerUpload.single(field);
  return (req, res, next) => {
    handler(req, res, (err) => (err ? next(toUploadError(err, field)) : next()));
  };
}

// Real content check for a saved file: JPEG FF D8 FF, PNG 89 50 4E 47,
// PDF "%PDF". Returns true when the bytes match the declared type.
function contentMatchesType(filePath, mimetype) {
  let fd;
  try {
    fd = fs.openSync(filePath, "r");
    const head = Buffer.alloc(8);
    const read = fs.readSync(fd, head, 0, 8, 0);
    if (mimetype === "image/jpeg") return read >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    if (mimetype === "image/png") return read >= 4 && head.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    if (mimetype === "application/pdf") return read >= 4 && head.subarray(0, 4).toString("latin1") === "%PDF";
    return false;
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

module.exports = {
  single,
  contentMatchesType,
  TYPE_MESSAGE,
  MAX_RECEIPT_BYTES,
};