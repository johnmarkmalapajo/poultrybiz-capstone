const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["Owner", "Farmer"],
      required: true,
    },

    status: {
      type: String,
      enum: ["Pending", "Active", "Inactive"],
      default: "Pending",
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

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    address: {
      type: String,
      default: "",
      trim: true,
    },

    avatar: {
      type: String,
      default: "",
    },

    lastLogin: {
      type: Date,
      default: null,
    },

    language: {
      type: String,
      default: "English",
    },

    timezone: {
      type: String,
      default: "(GMT+08:00) Asia/Manila",
    },

    farmName: {
      type: String,
      default: "",
      trim: true,
    },

    farmLocation: {
      type: String,
      default: "",
      trim: true,
    },

    farmContact: {
      type: String,
      default: "",
      trim: true,
    },

    farmEmail: {
      type: String,
      default: "",
      trim: true,
    },

    farmLogo: {
      type: String,
      default: "",
    },

    emailNotif: {
      type: Boolean,
      default: true,
    },

    loginAlerts: {
      type: Boolean,
      default: true,
    },

    resetToken: {
      type: String,
      default: null,
    },

    resetTokenExpiry: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);