const mongoose = require("mongoose");

const TimeLogSchema = new mongoose.Schema(
  {
    task_id: {
      type: mongoose.Types.ObjectId,
      ref: "Tasks",
    },
    serviceRequestId: {
      type: mongoose.Types.ObjectId,
      ref: "ServiceRequest",
      required: true,
    },
    user_id: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
    punchInTime: {
      type: Date,
      required: true,
    },
    punchOutTime: {
      type: Date,
      required: false,
    },
    punchInLocation: {
      type: String,
    },
    punchOutLocation: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const TimeLog = mongoose.model("TimeLog", TimeLogSchema);

module.exports = { TimeLog };
