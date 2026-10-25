const mongoose = require("mongoose");

const feedStockSettingSchema = new mongoose.Schema(
  {
    feedType: {
      type: String,
      required: true,
      trim: true,
    },

    feedKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    sackWeightKg: {
      type: Number,
      required: true,
      min: 0.01,
      max: 1000,
      default: 50,
    },

    lowStockThreshold: {
      type: Number,
      required: true,
      min: 0,
      default: 100,
    },

    thresholdUnit: {
      type: String,
      enum: ["kg", "sacks"],
      default: "kg",
    },

    updatedBy: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "FeedStockSetting",
  feedStockSettingSchema
);