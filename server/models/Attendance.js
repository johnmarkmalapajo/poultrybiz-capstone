const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    personnel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Personnel",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    timeIn: {
      type: Date,
      default: null,
    },

    timeOut: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["Present", "Late", "Absent"],
      default: "Present",
    },

    remarks: {
      type: String,
      default: "",
    },

    attendanceType: {
      type: String,
      enum: ["QR"],
      default: "QR",
    },
  },
  {
    timestamps: true,
  }
);

attendanceSchema.index({
  personnel: 1,
  date: 1,
});

module.exports = mongoose.model("Attendance", attendanceSchema);