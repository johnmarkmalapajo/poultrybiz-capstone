const mongoose = require("mongoose");

const archiveSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      required: true,
    },

    moduleKey: {
      type: String,
      required: true,
    },

    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    recordName: {
      type: String,
      required: true,
    },

    archivedBy: {
      type: String,
      required: true,
    },

    archivedAt: {
      type: Date,
      default: Date.now,
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Archive", archiveSchema);