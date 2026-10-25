const mongoose = require("mongoose");

// One document per login. The JWT carries this session's id (jti), so the
// server can end a session on logout or after inactivity even though the
// JWT itself has not expired yet.
const authSessionSchema = new mongoose.Schema(
  {
    jti: {
      type: String,
      required: true,
      unique: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    lastSeenAt: {
      type: Date,
      default: Date.now,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revokedReason: {
      type: String,
      enum: ["", "logout", "inactivity"],
      default: "",
    },

    // Same lifetime as the JWT; MongoDB removes the document afterwards.
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AuthSession", authSessionSchema);