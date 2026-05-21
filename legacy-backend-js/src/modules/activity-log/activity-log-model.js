const mongoose = require("mongoose");

// This is a virtual model for activity logs that combines data from Tasks and TimeLogs
// We'll use aggregation pipelines to create activity log entries

const ActivityLogVirtualSchema = new mongoose.Schema(
  {
    // Task Information
    taskId: {
      type: String,
      required: true,
    },
    taskTitle: {
      type: String,
      required: true,
    },
    taskDescription: {
      type: String,
    },
    taskStatus: {
      type: String,
      enum: ["Yet to start", "In progress", "Completed"],
    },
    taskDate: {
      type: String,
    },
    taskFiles: [
      {
        type: String,
      },
    ],

    // User Information
    assignedTo: {
      userId: {
        type: mongoose.Types.ObjectId,
        ref: "User",
      },
      name: String,
      email: String,
      mobile: String,
      profileImage: String,
    },

    // Service Request Information
    serviceRequestId: {
      type: mongoose.Types.ObjectId,
      ref: "ServiceRequest",
    },

    // Time Log Information
    timeLogId: {
      type: mongoose.Types.ObjectId,
    },
    punchInTime: {
      type: Date,
    },
    punchOutTime: {
      type: Date,
    },
    punchInLocation: {
      type: String,
    },
    punchOutLocation: {
      type: String,
    },
    workDuration: {
      type: Number, // in minutes
    },

    // Calculated fields
    isActive: {
      type: Boolean, // true if punch in without punch out
      default: false,
    },
    date: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// We won't actually create this model since it's virtual
// const ActivityLog = mongoose.model("ActivityLog", ActivityLogVirtualSchema);

module.exports = { ActivityLogVirtualSchema };
