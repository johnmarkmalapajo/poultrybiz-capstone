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

    // Public URL of the profile picture, e.g.
    // "/api/v1/profile/avatar/<userId>?v=<timestamp>". The image itself is
    // stored in `avatarImage` below (in MongoDB), NOT on the server's disk:
    // Render's disk is wiped on every redeploy / restart, which is what made
    // uploaded pictures disappear. Older records may still hold a legacy
    // "/uploads/profile/..." path (see migrateLegacyImages).
    avatar: {
      type: String,
      default: "",
    },

    // The profile picture's bytes. select:false -- never loaded with the
    // user unless explicitly asked for (only the image endpoint does).
    avatarImage: {
      type: {
        data: { type: Buffer, default: null },
        contentType: { type: String, default: "" },
        size: { type: Number, default: 0 },
        updatedAt: { type: Date, default: null },
      },
      select: false,
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

    // My Profile > Text Size. Saved on the account so it follows the user
    // to every device and browser; each account has its own.
    textSize: {
      type: String,
      enum: ["small", "default", "large", "xlarge"],
      default: "default",
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

    // Sales Record > Egg Pricing (farm-level, on the Owner's record like the
    // other farm settings): the selling price PER EGG for each egg size,
    // used to fill the Unit Price of new sales. null = no price set yet
    // (that size can't be sold until one is set). Each sale keeps its own
    // unit price, so changing these never changes past sales.
    eggPrices: {
      peewee: { type: Number, default: null, min: 0 },
      small: { type: Number, default: null, min: 0 },
      medium: { type: Number, default: null, min: 0 },
      large: { type: Number, default: null, min: 0 },
      extraLarge: { type: Number, default: null, min: 0 },
      jumbo: { type: Number, default: null, min: 0 },
    },
    eggPricesUpdatedAt: {
      type: Date,
      default: null,
    },

    // Farm logo (kept on the Owner's record, where all farm identity fields
    // live -- getFarmInfo serves it to every user). URL like
    // "/api/v1/profile/farm-logo?v=<timestamp>"; bytes in farmLogoImage.
    farmLogo: {
      type: String,
      default: "",
    },

    farmLogoImage: {
      type: {
        data: { type: Buffer, default: null },
        contentType: { type: String, default: "" },
        size: { type: Number, default: 0 },
        updatedAt: { type: Date, default: null },
      },
      select: false,
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

    // Owner only: the code printed in the official Attendance QR. It
    // identifies the farm's attendance station -- it is not a login
    // credential. Hidden from normal user queries.
    attendanceQrToken: {
      type: String,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);