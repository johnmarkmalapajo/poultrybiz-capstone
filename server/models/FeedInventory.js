const mongoose = require("mongoose");

const feedInventorySchema = new mongoose.Schema(
  {
    expenseRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExpenseRecord",
      default: null,
    },

    date: {
      type: Date,
      required: true,
    },

    feedType: {
      type: String,
      required: true,
      trim: true,
    },

    supplier: {
      type: String,
      default: "",
      trim: true,
    },

    quantity: {
      type: Number,
      min: 0,
      default: 0,
    },

    quantityUnit: {
      type: String,
      enum: ["sacks", "kg"],
      default: "sacks",
    },

    quantityIn: {
      type: Number,
      required: true,
      min: 0,
    },

    quantityOut: {
      type: Number,
      default: 0,
      min: 0,
    },

    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    equivalentKg: {
      type: Number,
      default: 0,
      min: 0,
    },

    amount: {
      type: Number,
      default: 0,
      min: 0,
    },

    receipt: {
      type: String,
      default: "",
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
  "FeedInventory",
  feedInventorySchema
);