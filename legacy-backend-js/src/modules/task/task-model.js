const mongoose = require("mongoose");

const Status = {
  PENDING: "Yet to start",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

const TaskSchema = new mongoose.Schema(
  {
    TaskId: {
      type: String,
      required: true,
      unique: true,
    },
    serviceRequestId: {
      type: mongoose.Types.ObjectId,
      ref: "ServiceRequest",
      required: true,
    },
    created_by: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
    user_id: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
    title: {
      type: String,
      required: true,
    },
    file_url: {
      type: [String],
      required: true,
    },
    task_date: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      default: Status.PENDING,
      enum: Object.values(Status),
    },
    logs: [
      {
        status: {
          type: String,
          default: Status.PENDING,
          enum: Object.values(Status),
        },
        updated_by: {
          type: mongoose.Types.ObjectId,
          ref: "User",
        },
        timestamp: {
          type: Date,
          default: new Date(),
        },
        remarks: {
          type: String,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const TaskModel = mongoose.model("Tasks", TaskSchema);

module.exports = { TaskModel, Status };
