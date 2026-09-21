const mongoose = require("mongoose");

const feedConsumptionSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    batchId: {
      type: String,
      required: true,
      trim: true,
    },

    feedType: {
      type: String,
      required: true,
      trim: true,
    },

    quantityConsumed: {
      type: Number,
      required: true,
      min: 0,
    },
    quantityUnit: {
     type: String,
    enum: ["kg", "sacks"],
    default: "kg",
    required: true,
  },

    currentAge: {
      type: Number,
      default: null,
    },

    currentQuantity: {
      type: Number,
      default: null,
    },

    feedTransition: {
      type: String,
      default: "",
      trim: true,
    },

    gPerHeadPerDay: {
      type: Number,
      default: null,
    },

    notes: {
      type: String,
      default: "",
      maxlength: 255,
      trim: true,
    },

    archived: {
      type: Boolean,
      default: false,
    },

    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "FeedConsumption",
  feedConsumptionSchema
);