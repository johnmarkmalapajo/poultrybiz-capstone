const mongoose = require("mongoose");

const saleItemSchema = new mongoose.Schema(
  {
    eggSize: {
      type: String,
      required: true,
      enum: ["Peewee", "Small", "Medium", "Large", "Extra Large", "Jumbo"],
    },

    quantitySold: {
      type: Number,
      required: true,
      min: 1,
    },

    unit: {
      type: String,
      required: true,
      enum: ["Pieces", "Trays"],
    },

    eggsEquivalent: {
      type: Number,
      required: true,
      min: 1,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const salesRecordSchema = new mongoose.Schema(
  {
    dateOfSale: {
      type: Date,
      required: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    buyer: {
      type: String,
      required: true,
      trim: true,
    },


    items: {
      type: [saleItemSchema],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "A sale must contain at least one egg-size item.",
      },
    },

    totalEggs: {
      type: Number,
      required: true,
      min: 0,
    },

    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },

    isArchived: {
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

module.exports = mongoose.model("SalesRecord", salesRecordSchema);