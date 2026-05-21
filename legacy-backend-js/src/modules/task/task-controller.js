const { default: mongoose } = require("mongoose");
const { TaskModel, Status } = require("./task-model");

// Helper function to generate TaskId
async function generateTaskId(serviceRequestId) {
  try {
    // First populate the serviceRequest to get serviceNumber
    const serviceRequest = await mongoose
      .model("ServiceRequest")
      .findById(serviceRequestId);
    if (!serviceRequest) {
      throw new Error("Service Request not found");
    }

    const serviceNumber = serviceRequest.serviceNumber;

    // Find all tasks with TaskId to get the globally highest sequence number
    const allTasks = await TaskModel.find({
      TaskId: { $exists: true, $ne: null },
    }).select("TaskId");

    let maxSequenceNumber = 0;

    // Iterate through all tasks to find the highest sequence number
    allTasks.forEach((task) => {
      if (task.TaskId) {
        // Extract the sequence number from TaskId
        // Format: Task-(serviceNumber)-00001
        const taskIdParts = task.TaskId.split("-");
        if (taskIdParts.length >= 3) {
          const sequenceStr = taskIdParts[taskIdParts.length - 1];
          const sequenceNumber = parseInt(sequenceStr);
          if (sequenceNumber > maxSequenceNumber) {
            maxSequenceNumber = sequenceNumber;
          }
        }
      }
    });

    // Next sequence number will be maxSequenceNumber + 1
    const nextSequenceNumber = maxSequenceNumber + 1;

    // Format sequence number with leading zeros (5 digits)
    const formattedSequence = nextSequenceNumber.toString().padStart(5, "0");

    return `Task-${serviceNumber}-${formattedSequence}`;
  } catch (error) {
    console.error("Error generating TaskId:", error);
    throw error;
  }
}

// Create a new task
async function createTask(req, res) {
  try {
    let taskData = { ...req.body };

    // Generate TaskId if not provided
    if (!req.body.TaskId) {
      taskData.TaskId = await generateTaskId(req.body.serviceRequestId);
    }

    const task = new TaskModel({
      ...taskData,
      logs: [
        {
          status: "Yet to start",
          remarks: `Task created by ${req?.body?.username}`,
        },
      ],
    });

    await task.save();
    res
      .status(201)
      .json({ message: "Task Created Successfully", taskId: task.TaskId });
  } catch (error) {
    console.log(error, "errrrrr");
    res
      .status(400)
      .json({ message: "Error Creating Task", error: error.message });
  }
}

// async function getTaskByServiceId(req, res) {
//   try {
//     const tasks = await TaskModel.find({
//       serviceRequestId: req.params.serviceId,
//       $or: req?.query?.user_id
//         ? [
//             { user_id: req?.query?.user_id },
//             { created_by: req?.query?.user_id },
//           ]
//         : undefined,
//     })
//       .populate([
//         "serviceRequestId",
//         "user_id",
//         "created_by",
//         "logs.updated_by",
//       ])
//       .sort({ createdAt: -1 });

//     res.json(tasks);
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Error Getting Tasks", error: error.message });
//   }
// }
// async function getTaskByQuery(req, res) {
//   try {
//     const { user_id, ...rest } = req?.query;
//     const tasks = await TaskModel.find({
//       ...rest,
//       $or: user_id
//         ? [{ user_id: user_id }, { created_by: user_id }]
//         : undefined,
//     })
//       .populate([
//         "serviceRequestId",
//         "user_id",
//         "created_by",
//         "logs.updated_by",
//       ])
//       .sort({ createdAt: -1 });

//     res.json(tasks);
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Error Getting Tasks", error: error.message });
//   }
// }

async function getTaskByServiceId(req, res) {
  try {
    const match = {
      serviceRequestId: req.params.serviceId,
    };

    if (req?.query?.user_id) {
      match.$or = [
        { user_id: req.query.user_id },
        { created_by: req.query.user_id },
      ];
    }

    const tasks = await TaskModel.aggregate([
      {
        $addFields: {
          serviceRequestId: {
            $toString: "$serviceRequestId",
          },
        },
      },
      { $match: match },
      {
        $addFields: {
          target_status: {
            $let: {
              vars: {
                taskDate: {
                  $dateFromString: {
                    dateString: "$task_date",
                    onError: "$$NOW",
                  },
                },
                taskDateEnd: {
                  $dateAdd: {
                    startDate: {
                      $dateFromString: {
                        dateString: "$task_date",
                        onError: "$$NOW",
                      },
                    },
                    unit: "millisecond",
                    amount: 86399999, // 23:59:59.999
                  },
                },
                timeDiff: {
                  $subtract: [
                    {
                      $dateAdd: {
                        startDate: {
                          $dateFromString: {
                            dateString: "$task_date",
                            onError: "$$NOW",
                          },
                        },
                        unit: "millisecond",
                        amount: 86399999,
                      },
                    },
                    "$$NOW",
                  ],
                },
              },
              in: {
                $cond: {
                  if: { $gt: ["$$taskDateEnd", "$$NOW"] },
                  then: "running on time",
                  else: {
                    $concat: [
                      "delayed by ",
                      {
                        $cond: {
                          if: {
                            $gte: [
                              { $abs: { $divide: ["$$timeDiff", 86400000] } },
                              1,
                            ],
                          },
                          then: {
                            $concat: [
                              {
                                $toString: {
                                  $floor: {
                                    $abs: { $divide: ["$$timeDiff", 86400000] },
                                  },
                                },
                              },
                              " days",
                            ],
                          },
                          else: {
                            $cond: {
                              if: {
                                $gte: [
                                  {
                                    $abs: { $divide: ["$$timeDiff", 3600000] },
                                  },
                                  1,
                                ],
                              },
                              then: {
                                $concat: [
                                  {
                                    $toString: {
                                      $floor: {
                                        $abs: {
                                          $divide: ["$$timeDiff", 3600000],
                                        },
                                      },
                                    },
                                  },
                                  " hrs",
                                ],
                              },
                              else: {
                                $concat: [
                                  {
                                    $toString: {
                                      $floor: {
                                        $abs: {
                                          $divide: ["$$timeDiff", 60000],
                                        },
                                      },
                                    },
                                  },
                                  " min",
                                ],
                              },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "timelogs",
          localField: "_id",
          foreignField: "task_id",
          as: "timeLogs",
        },
      },
      {
        $unwind: {
          path: "$timeLogs",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "timeLogs.user_id",
          foreignField: "_id",
          as: "timeLogs.user",
        },
      },
      {
        $unwind: {
          path: "$timeLogs.user",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$_id",
          doc: { $first: "$$ROOT" },
          timeLogs: { $push: "$timeLogs" },
        },
      },
      {
        $addFields: {
          "doc.timeLogs": "$timeLogs",
        },
      },
      {
        $replaceRoot: {
          newRoot: "$doc",
        },
      },
      {
        $addFields: {
          TaskId: "$TaskId",
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    // Manually populate referenced fields (since .aggregate doesn't auto-populate)
    await TaskModel.populate(tasks, [
      { path: "serviceRequestId" },
      { path: "user_id" },
      { path: "created_by" },
      { path: "logs.updated_by" },
    ]);

    // Calculate status counts
    let total_pending = 0,
      total_completed = 0,
      total_inprogress = 0;
    tasks.forEach((task) => {
      if (task.status === "Yet to start") total_pending++;
      else if (task.status === "Completed") total_completed++;
      else if (task.status === "In progress") total_inprogress++;
    });
    res.json({
      tasks,
      total_pending,
      total_completed,
      total_inprogress,
    });
  } catch (error) {
    console.log(error, "errrrrr");

    res
      .status(500)
      .json({ message: "Error Getting Tasks", error: error.message });
  }
}

async function getTaskByQuery(req, res) {
  try {
    const { user_id, serviceRequestId, serviceRequestIds, ...rest } = req.query;
    let match = { ...rest };

    // Support both singular and plural keys
    let finalServiceRequestId =
      serviceRequestId ||
      serviceRequestIds ||
      req.body.serviceRequestId ||
      req.body.serviceRequestIds;

    if (Array.isArray(finalServiceRequestId)) {
      match.serviceRequestId = { $in: finalServiceRequestId };
    } else if (typeof finalServiceRequestId === "string") {
      const ids = finalServiceRequestId
        .replace(/[\[\]]/g, "")
        .split(",")
        .map((id) => id.trim());
      match.serviceRequestId = { $in: ids };
    }
    // console.log("finalServiceRequestId", finalServiceRequestId, "match", match);
    if (user_id) {
      match.$or = [{ user_id: user_id }, { created_by: user_id }];
    }

    const tasks = await TaskModel.aggregate([
      {
        $addFields: {
          serviceRequestId: { $toString: "$serviceRequestId" },
          user_id: { $toString: "$user_id" },
          created_by: { $toString: "$created_by" },
        },
      },
      { $match: match },
      {
        $addFields: {
          target_status: {
            $let: {
              vars: {
                taskDate: {
                  $dateFromString: {
                    dateString: "$task_date",
                    onError: "$$NOW",
                  },
                },
                taskDateEnd: {
                  $dateAdd: {
                    startDate: {
                      $dateFromString: {
                        dateString: "$task_date",
                        onError: "$$NOW",
                      },
                    },
                    unit: "millisecond",
                    amount: 86399999,
                  },
                },
                timeDiff: {
                  $subtract: [
                    {
                      $dateAdd: {
                        startDate: {
                          $dateFromString: {
                            dateString: "$task_date",
                            onError: "$$NOW",
                          },
                        },
                        unit: "millisecond",
                        amount: 86399999,
                      },
                    },
                    "$$NOW",
                  ],
                },
              },
              in: {
                $cond: {
                  if: { $gt: ["$$taskDateEnd", "$$NOW"] },
                  then: "running on time",
                  else: {
                    $concat: [
                      "delayed by ",
                      {
                        $cond: {
                          if: {
                            $gte: [
                              { $abs: { $divide: ["$$timeDiff", 86400000] } },
                              1,
                            ],
                          },
                          then: {
                            $concat: [
                              {
                                $toString: {
                                  $floor: {
                                    $abs: { $divide: ["$$timeDiff", 86400000] },
                                  },
                                },
                              },
                              " days",
                            ],
                          },
                          else: {
                            $cond: {
                              if: {
                                $gte: [
                                  {
                                    $abs: { $divide: ["$$timeDiff", 3600000] },
                                  },
                                  1,
                                ],
                              },
                              then: {
                                $concat: [
                                  {
                                    $toString: {
                                      $floor: {
                                        $abs: {
                                          $divide: ["$$timeDiff", 3600000],
                                        },
                                      },
                                    },
                                  },
                                  " hrs",
                                ],
                              },
                              else: {
                                $concat: [
                                  {
                                    $toString: {
                                      $floor: {
                                        $abs: {
                                          $divide: ["$$timeDiff", 60000],
                                        },
                                      },
                                    },
                                  },
                                  " min",
                                ],
                              },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "timelogs",
          localField: "_id",
          foreignField: "task_id",
          as: "timeLogs",
        },
      },
      {
        $unwind: {
          path: "$timeLogs",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "timeLogs.user_id",
          foreignField: "_id",
          as: "timeLogs.user_id",
        },
      },
      {
        $unwind: {
          path: "$timeLogs.user_id",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$_id",
          doc: { $first: "$$ROOT" },
          timeLogs: { $push: "$timeLogs" },
        },
      },
      {
        $addFields: {
          "doc.timeLogs": "$timeLogs",
        },
      },
      {
        $replaceRoot: {
          newRoot: "$doc",
        },
      },
      {
        $addFields: {
          TaskId: {
            $ifNull: ["$TaskId", null],
          },
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    await TaskModel.populate(tasks, [
      { path: "serviceRequestId" },
      { path: "user_id" },
      { path: "created_by" },
      { path: "logs.updated_by" },
    ]);

    const tasksWithBranchData = await Promise.all(
      tasks.map(async (task) => {
        if (task.serviceRequestId && task.serviceRequestId.branch_id) {
          const branchData = await mongoose
            .model("Branch")
            .findById(task.serviceRequestId.branch_id);
          return {
            ...(task.toObject ? task.toObject() : task),
            branchData: branchData || null,
          };
        }
        return task.toObject ? task.toObject() : task;
      })
    );

    // Calculate status counts
    let total_pending = 0,
      total_completed = 0,
      total_inprogress = 0;
    tasksWithBranchData.forEach((task) => {
      if (task.status === "Yet to start") total_pending++;
      else if (task.status === "Completed") total_completed++;
      else if (task.status === "In progress") total_inprogress++;
    });
    res.json({
      tasks: tasksWithBranchData,
      total_pending,
      total_completed,
      total_inprogress,
    });
  } catch (error) {
    console.log(error, "errrrrr");
    res
      .status(500)
      .json({ message: "Error Getting Tasks", error: error.message });
  }
}

// Update task status
async function updateTaskStatus(req, res) {
  try {
    // First check if task exists and has TaskId
    const existingTask = await TaskModel.findById(req.params.id);
    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    let updateData = { ...req?.body };

    // Generate TaskId if it doesn't exist
    if (!existingTask.TaskId) {
      updateData.TaskId = await generateTaskId(existingTask.serviceRequestId);
    }

    const updatedTask = await TaskModel.findByIdAndUpdate(
      req.params.id,
      {
        ...updateData,
        $push: {
          logs: {
            status: req?.body?.status,
            remarks: req?.body?.remarks,
            updated_by: req?.body?.updated_by,
            timestamp: new Date(),
          },
        },
      },
      { new: true }
    );

    res.json({
      message: "Task Updated Successfully",
      taskId: updatedTask.TaskId,
    });
  } catch (error) {
    console.log(error, "errrrrr");
    res
      .status(400)
      .json({ message: "Error Updating status", error: error.message });
  }
}

const deleteTask = async (req, res) => {
  try {
    const deletedTask = await TaskModel.findByIdAndDelete(req.params.id);
    if (!deletedTask) {
      return res.status(404).json({ message: "Task not found" });
    }
    return res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error deleting Task", error: error.message });
  }
};

// Get the last TaskId
async function getLastTaskId(req, res) {
  try {
    const { serviceRequestId } = req.params;

    if (serviceRequestId) {
      // Get all TaskIds for a specific service request
      const tasks = await TaskModel.find({
        serviceRequestId: serviceRequestId,
        TaskId: { $exists: true, $ne: null },
      }).select("TaskId createdAt");

      if (tasks.length === 0) {
        return res.json({
          message: "No tasks found for this service request",
          lastTaskId: null,
          serviceRequestId: serviceRequestId,
        });
      }

      // Find the task with the highest sequence number
      let maxSequenceNumber = 0;
      let lastTask = null;

      tasks.forEach((task) => {
        if (task.TaskId) {
          // Extract sequence number from TaskId (format: Task-SR001-00001)
          const taskIdParts = task.TaskId.split("-");
          if (taskIdParts.length >= 3) {
            const sequenceStr = taskIdParts[taskIdParts.length - 1];
            const sequenceNumber = parseInt(sequenceStr);
            if (sequenceNumber > maxSequenceNumber) {
              maxSequenceNumber = sequenceNumber;
              lastTask = task;
            }
          }
        }
      });

      if (!lastTask) {
        return res.json({
          message: "No valid TaskId found for this service request",
          lastTaskId: null,
          serviceRequestId: serviceRequestId,
        });
      }

      return res.json({
        message: "Last TaskId retrieved successfully",
        lastTaskId: lastTask.TaskId,
        serviceRequestId: serviceRequestId,
        sequenceNumber: maxSequenceNumber,
        createdAt: lastTask.createdAt,
      });
    } else {
      // Get all TaskIds in the system
      const tasks = await TaskModel.find({
        TaskId: { $exists: true, $ne: null },
      })
        .select("TaskId serviceRequestId createdAt")
        .populate("serviceRequestId", "serviceNumber");

      if (tasks.length === 0) {
        return res.json({
          message: "No tasks found in the system",
          lastTaskId: null,
        });
      }

      // Find the task with the highest sequence number across all service requests
      let maxSequenceNumber = 0;
      let lastTask = null;

      tasks.forEach((task) => {
        if (task.TaskId) {
          // Extract sequence number from TaskId (format: Task-SR001-00001)
          const taskIdParts = task.TaskId.split("-");
          if (taskIdParts.length >= 3) {
            const sequenceStr = taskIdParts[taskIdParts.length - 1];
            const sequenceNumber = parseInt(sequenceStr);
            if (sequenceNumber > maxSequenceNumber) {
              maxSequenceNumber = sequenceNumber;
              lastTask = task;
            }
          }
        }
      });

      if (!lastTask) {
        return res.json({
          message: "No valid TaskId found in the system",
          lastTaskId: null,
        });
      }

      return res.json({
        message: "Last TaskId retrieved successfully",
        lastTaskId: lastTask.TaskId,
        serviceRequestId: lastTask.serviceRequestId,
        sequenceNumber: maxSequenceNumber,
        createdAt: lastTask.createdAt,
      });
    }
  } catch (error) {
    console.log(error, "Error getting last TaskId");
    res.status(500).json({
      message: "Error getting last TaskId",
      error: error.message,
    });
  }
}

module.exports = {
  createTask,
  getTaskByServiceId,
  getTaskByQuery,
  updateTaskStatus,
  deleteTask,
  getLastTaskId, // Add the new function to exports
};
