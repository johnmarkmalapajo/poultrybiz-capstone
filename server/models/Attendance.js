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

    // "<personnelId>:<YYYY-MM-DD PH date>". Unique, so two scans that arrive
    // at the same moment can never create two records for the same day.
    // Older records without it are still found by the date-range lookup.
    dayKey: {
      type: String,
      default: undefined,
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

attendanceSchema.index({ dayKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Attendance", attendanceSchema);