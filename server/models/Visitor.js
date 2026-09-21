const mongoose = require("mongoose");

const visitorSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      type: String,
      required: true,
    },

    affiliation: {
      type: String,
      required: true,
    },

    contactNumber: {
      type: String,
      required: true,
    },

    visitCount: {
      type: Number,
      default: 0,
    },

    lastVisitDate: {
      type: Date,
      default: null,
    },

    archived: {
      type: Boolean,
      default: false,
    },

    archivedAt: {
      type: Date,
      default: null,
    },

    archivedBy: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Visitor", visitorSchema);