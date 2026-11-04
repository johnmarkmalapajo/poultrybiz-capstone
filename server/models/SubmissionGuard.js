const mongoose = require("mongoose");

// Short-lived fingerprint of a create (POST) request. The unique index on
// `key` makes the "first submission wins" decision atomic in MongoDB, so two
// simultaneous identical requests can never both pass. Documents are removed
// automatically after the protection window by the TTL index on createdAt.
const submissionGuardSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now, expires: 180 },
});

module.exports =
  mongoose.models.SubmissionGuard ||
  mongoose.model("SubmissionGuard", submissionGuardSchema);