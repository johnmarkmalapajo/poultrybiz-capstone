const crypto = require("crypto");
const SubmissionGuard = require("../models/SubmissionGuard");

// Identical submissions from the same user to the same endpoint within this
// window are treated as an accidental duplicate (double-click, retry, replay).
const WINDOW_MS = 2 * 60 * 1000;

const DUPLICATE_MESSAGE =
  "This record has already been submitted. Only one record will be saved.";

// Stable stringify: object keys are sorted so field order never changes the
// fingerprint; strings are trimmed so stray spaces do not defeat the check.
const canonical = (value) => {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  }
  if (typeof value === "string") return JSON.stringify(value.trim());
  return JSON.stringify(value);
};

const fingerprint = (req) => {
  const userId = String(req.user?.id || req.user?._id || "anonymous");
  const target = `${req.method}:${req.baseUrl}${req.path}`;
  const hasFile = !!req.file || (Array.isArray(req.files) && req.files.length > 0);
  const fileSig = hasFile
    ? canonical(
        [req.file, ...(req.files || [])]
          .filter(Boolean)
          .map((f) => [f.originalname, f.size])
      )
    : "";
  const hash = crypto
    .createHash("sha256")
    .update(`${userId}|${target}|${canonical(req.body || {})}|${req.params ? canonical(req.params) : ""}|${fileSig}`)
    .digest("hex");
  return hash;
};

// Claim the key. Returns true if this request is the first one in the window.
const claim = async (key, windowMs = WINDOW_MS) => {
  try {
    await SubmissionGuard.create({ key });
    return true;
  } catch (err) {
    if (err?.code !== 11000) throw err;
    // The TTL sweeper only runs about once a minute, so an expired marker
    // may still exist. Remove it only if it is really outside the window.
    const removed = await SubmissionGuard.findOneAndDelete({
      key,
      createdAt: { $lt: new Date(Date.now() - windowMs) },
    });
    if (!removed) return false;
    try {
      await SubmissionGuard.create({ key });
      return true;
    } catch (retryErr) {
      if (retryErr?.code === 11000) return false;
      throw retryErr;
    }
  }
};

// Use on create (POST) routes AFTER `protect` (and after any multer upload
// middleware). If the downstream handler does not succeed, the marker is
// released so the user can correct the form and submit again right away.
const preventDuplicateSubmission = async (req, res, next) => {
  let key;
  try {
    key = fingerprint(req);
    const first = await claim(key);
    if (!first) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        message: DUPLICATE_MESSAGE,
      });
    }
  } catch (err) {
    console.error("duplicateGuard error:", err);
    return res.status(503).json({
      success: false,
      message: "Unable to verify this submission right now. Please try again.",
    });
  }

  // Release the marker BEFORE a failed (non-2xx) response is sent, so a user
  // who fixes the form and resubmits immediately is never rejected as a
  // duplicate of the failed attempt.
  const originalJson = res.json.bind(res);
  res.json = async (body) => {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      await SubmissionGuard.deleteOne({ key }).catch(() => {});
    }
    return originalJson(body);
  };

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      SubmissionGuard.deleteOne({ key }).catch(() => {});
    }
  });
  res.on("close", () => {
    if (!res.writableEnded) {
      SubmissionGuard.deleteOne({ key }).catch(() => {});
    }
  });

  return next();
};

const release = (key) => SubmissionGuard.deleteOne({ key }).catch(() => {});

module.exports = {
  preventDuplicateSubmission,
  DUPLICATE_MESSAGE,
  WINDOW_MS,
  claim,
  release,
};