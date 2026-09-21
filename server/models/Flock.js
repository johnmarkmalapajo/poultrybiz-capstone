const mongoose = require("mongoose");

const flockSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    breed: {
      type: String,
      required: true,
      trim: true,
    },

    supplier: {
      type: String,
      required: true,
      trim: true,
    },

    source: {
      type: String,
      trim: true,
      default: "",
    },

    dateAcquired: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          if (!value) return true;
          const phNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
          const todayStr = `${phNow.getUTCFullYear()}-${String(phNow.getUTCMonth() + 1).padStart(2, "0")}-${String(phNow.getUTCDate()).padStart(2, "0")}`;
          const valueStr = value.toISOString().slice(0, 10);
          return valueStr <= todayStr;
        },
        message: "Date Acquired cannot be in the future.",
      },
    },

    quantityPurchased: {
      type: Number,
      required: true,
      min: 1,
    },

    currentQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    totalMortality: {
      type: Number,
      default: 0,
      min: 0,
    },

    mortalityRate: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ["Active", "Quarantined", "Culled"],
      default: "Active",
    },

    isArchived: {
      type: Boolean,
      default: false,
    },

    archivedAt: {
      type: Date,
      default: null,
    },

    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.models.Flock || mongoose.model("Flock", flockSchema);