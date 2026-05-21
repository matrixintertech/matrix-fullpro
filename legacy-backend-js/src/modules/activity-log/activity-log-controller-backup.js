const { TaskModel } = require("../task/task-model");
const { TimeLog } = require("../timeLog/time-log-model");
const { UserModal } = require("../user/user-modal");
const mongoose = require("mongoose");

// Helper function to calculate work duration in minutes
const calculateWorkDuration = (punchIn, punchOut) => {
  if (!punchIn || !punchOut) return 0;
  return Math.round((new Date(punchOut) - new Date(punchIn)) / (1000 * 60));
};

// Helper function to format work duration with days
const formatWorkDuration = (minutes) => {
  if (!minutes || minutes === 0) return "0d 0h 0m";

  const days = Math.floor(minutes / (24 * 60));
  const remainingMinutesAfterDays = minutes % (24 * 60);
  const hours = Math.floor(remainingMinutesAfterDays / 60);
  const mins = remainingMinutesAfterDays % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${mins}m`;
  } else {
    return `${hours}h ${mins}m`;
  }
};

// Get activity logs with comprehensive filtering and pagination
const getActivityLogs = async (req, res) => {
  try {
    const {
      userIds, // Can be single ID or array of IDs
      startDate,
      endDate,
      status,
      activeSession,
      page = 1,
      limit = 10,
      sortBy = "date",
      sortOrder = "desc",
      search,
    } = req.query;

    // Parse pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build match conditions for aggregation
    let matchConditions = {};

    // Filter by user IDs
    if (userIds) {
      let userIdArray;
      try {
        // Handle both JSON string and regular array/string
        if (typeof userIds === "string" && userIds.startsWith("[")) {
          userIdArray = JSON.parse(userIds);
        } else {
          userIdArray = Array.isArray(userIds) ? userIds : [userIds];
        }
        matchConditions["user_id"] = {
          $in: userIdArray.map((id) => new mongoose.Types.ObjectId(id)),
        };
      } catch (error) {
        console.error("Error parsing userIds:", error);
        return res.status(400).json({
          success: false,
          message: "Invalid userIds format",
        });
      }
    }

    // Filter by date range
    if (startDate || endDate) {
      matchConditions["createdAt"] = {};
      if (startDate) {
        matchConditions["createdAt"]["$gte"] = new Date(startDate);
      }
      if (endDate) {
        matchConditions["createdAt"]["$lte"] = new Date(endDate);
      }
    }

    // Filter by task status
    if (status && status !== "all") {
      matchConditions["status"] = status;
    }

    // Search functionality
    if (search) {
      matchConditions["$or"] = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { TaskId: { $regex: search, $options: "i" } },
      ];
    }

    // Build aggregation pipeline for tasks with time logs
    const pipeline = [
      {
        $match: matchConditions,
      },
      {
        $lookup: {
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "assignedUser",
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
        $lookup: {
          from: "servicerequests",
          localField: "serviceRequestId",
          foreignField: "_id",
          as: "serviceRequest",
        },
      },
      {
        $unwind: {
          path: "$assignedUser",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: "$serviceRequest",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          totalTimeLogs: { $size: "$timeLogs" },
          totalWorkHours: {
            $reduce: {
              input: "$timeLogs",
              initialValue: 0,
              in: {
                $add: [
                  "$$value",
                  {
                    $cond: {
                      if: {
                        $and: ["$$this.punchInTime", "$$this.punchOutTime"],
                      },
                      then: {
                        $divide: [
                          {
                            $subtract: [
                              "$$this.punchOutTime",
                              "$$this.punchInTime",
                            ],
                          },
                          60000,
                        ],
                      },
                      else: 0,
                    },
                  },
                ],
              },
            },
          },
          activeSession: {
            $filter: {
              input: "$timeLogs",
              cond: {
                $and: [
                  { $ne: ["$$this.punchInTime", null] },
                  { $eq: ["$$this.punchOutTime", null] },
                ],
              },
            },
          },
        },
      },
    ];

    // Filter by active session if specified - SIMPLE APPROACH
    if (activeSession && activeSession !== "all") {
      if (activeSession === "true") {
        // Only include tasks that have at least one time log with punch in but no punch out
        pipeline.push({
          $match: {
            timeLogs: {
              $elemMatch: {
                punchInTime: { $exists: true, $ne: null },
                $or: [
                  { punchOutTime: { $exists: false } },
                  { punchOutTime: null },
                ],
              },
            },
          },
        });
      } else if (activeSession === "false") {
        // Only include tasks that have NO active sessions
        pipeline.push({
          $match: {
            $expr: {
              $not: {
                $anyElementTrue: {
                  $map: {
                    input: "$timeLogs",
                    as: "timeLog",
                    in: {
                      $and: [
                        { $ne: ["$$timeLog.punchInTime", null] },
                        {
                          $or: [
                            { $eq: ["$$timeLog.punchOutTime", null] },
                            {
                              $not: {
                                $ifNull: ["$$timeLog.punchOutTime", true],
                              },
                            },
                          ],
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        });
      }
    }

    // Add sorting
    pipeline.push({
      $sort: {
        [sortBy === "date" ? "createdAt" : sortBy]:
          sortOrder === "desc" ? -1 : 1,
      },
    });

    // Get total count for pagination
    const countPipeline = [...pipeline, { $count: "total" }];
    const totalResult = await TaskModel.aggregate(countPipeline);
    const totalRecords = totalResult.length > 0 ? totalResult[0].total : 0;

    // Add pagination to main pipeline
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limitNum });

    // Execute aggregation
    const tasks = await TaskModel.aggregate(pipeline);

    // Format the response data
    const activityLogs = [];

    for (const task of tasks) {
      const baseActivity = {
        taskId: task.TaskId,
        taskTitle: task.title,
        taskDescription: task.description,
        taskStatus: task.status,
        taskDate: task.task_date,
        taskFiles: task.file_url || [],
        assignedTo: task.assignedUser
          ? {
              userId: task.assignedUser._id,
              name: task.assignedUser.name,
              email: task.assignedUser.email,
              mobile: task.assignedUser.mobile,
              profileImage: task.assignedUser.profileImage,
            }
          : null,
        serviceRequestId: task.serviceRequestId,
        serviceRequest: task.serviceRequest || null,
        totalTimeLogs: task.totalTimeLogs,
        totalWorkHours: formatWorkDuration(Math.round(task.totalWorkHours)),
        totalWorkMinutes: Math.round(task.totalWorkHours),
        isActiveSession: false, // Will be calculated after processing time logs
        activeSessionDetails: null, // Will be calculated after processing time logs
        timeLogs: [],
      };

      // Add individual time log entries
      for (const timeLog of task.timeLogs) {
        const workDuration = calculateWorkDuration(
          timeLog.punchInTime,
          timeLog.punchOutTime
        );

        baseActivity.timeLogs.push({
          timeLogId: timeLog._id,
          punchInTime: timeLog.punchInTime,
          punchOutTime: timeLog.punchOutTime,
          punchInLocation: timeLog.punchInLocation,
          punchOutLocation: timeLog.punchOutLocation,
          workDuration: formatWorkDuration(workDuration),
          workMinutes: workDuration,
          isActive: !timeLog.punchOutTime,
          date: timeLog.punchInTime
            ? new Date(timeLog.punchInTime).toISOString().split("T")[0]
            : null,
        });
      }

      // Calculate active session details
      const activeTimeLogs = baseActivity.timeLogs.filter(
        (log) => log.isActive
      );
      baseActivity.isActiveSession = activeTimeLogs.length > 0;
      baseActivity.activeSessionDetails =
        activeTimeLogs.length > 0 ? activeTimeLogs[0] : null;

      // Sort time logs by punch in time (newest first)
      baseActivity.timeLogs.sort(
        (a, b) => new Date(b.punchInTime) - new Date(a.punchInTime)
      );

      activityLogs.push(baseActivity);
    }

    // Calculate summary statistics for filtered data
    const summaryPipeline = [
      { $match: matchConditions },
      {
        $lookup: {
          from: "timelogs",
          localField: "_id",
          foreignField: "task_id",
          as: "timeLogs",
        },
      },
      {
        $addFields: {
          totalWorkMinutes: {
            $reduce: {
              input: "$timeLogs",
              initialValue: 0,
              in: {
                $add: [
                  "$$value",
                  {
                    $cond: {
                      if: {
                        $and: ["$$this.punchInTime", "$$this.punchOutTime"],
                      },
                      then: {
                        $divide: [
                          {
                            $subtract: [
                              "$$this.punchOutTime",
                              "$$this.punchInTime",
                            ],
                          },
                          60000,
                        ],
                      },
                      else: 0,
                    },
                  },
                ],
              },
            },
          },
          activeSessions: {
            $size: {
              $filter: {
                input: "$timeLogs",
                cond: {
                  $and: [
                    { $ne: ["$$this.punchInTime", null] },
                    { $eq: ["$$this.punchOutTime", null] },
                  ],
                },
              },
            },
          },
          totalLogs: { $size: "$timeLogs" },
        },
      },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          totalActiveSessions: { $sum: "$activeSessions" },
          totalLogs: { $sum: "$totalLogs" },
          totalWorkMinutes: { $sum: "$totalWorkMinutes" },
          uniqueUsers: { $addToSet: "$user_id" },
        },
      },
    ];

    const summaryResult = await TaskModel.aggregate(summaryPipeline);
    const summary =
      summaryResult.length > 0
        ? summaryResult[0]
        : {
            totalTasks: 0,
            totalActiveSessions: 0,
            totalLogs: 0,
            totalWorkMinutes: 0,
            uniqueUsers: [],
          };

    // Get total logs count from entire database (all time logs only)
    const totalLogsCount = await TimeLog.countDocuments();

    // Get active sessions count from entire database (punch in without punch out)
    const activeSessionsCount = await TimeLog.countDocuments({
      punchInTime: { $exists: true, $ne: null },
      $or: [{ punchOutTime: { $exists: false } }, { punchOutTime: null }],
    });

    // Prepare response
    const response = {
      success: true,
      data: {
        activityLogs,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalRecords / limitNum),
          totalRecords,
          recordsPerPage: limitNum,
          hasNextPage: pageNum < Math.ceil(totalRecords / limitNum),
          hasPrevPage: pageNum > 1,
        },
        summary: {
          totalTasks: summary.totalTasks,
          totalLogs: totalLogsCount, // Total time logs from entire database
          activeSessions: activeSessionsCount, // Active sessions from entire database
          totalWorkHours: formatWorkDuration(
            Math.round(summary.totalWorkMinutes)
          ),
          totalWorkMinutes: Math.round(summary.totalWorkMinutes),
          uniqueUsers: summary.uniqueUsers.length,
        },
        filters: {
          userIds: userIds || null,
          startDate: startDate || null,
          endDate: endDate || null,
          status: status || "all",
          activeSession: activeSession || "all",
          search: search || null,
        },
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error in getActivityLogs:", error);
    console.error("Request query:", req.query);
    res.status(500).json({
      success: false,
      message: "Failed to fetch activity logs",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Get activity logs for a specific user
const getUserActivityLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const queryParams = { ...req.query, userIds: userId };

    // Reuse the main function with user ID filter
    req.query = queryParams;
    await getActivityLogs(req, res);
  } catch (error) {
    console.error("Error in getUserActivityLogs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user activity logs",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Get activity summary by date range
const getActivitySummaryByDateRange = async (req, res) => {
  try {
    const { startDate, endDate, userIds } = req.query;

    let matchConditions = {};

    // Filter by date range
    if (startDate || endDate) {
      matchConditions["createdAt"] = {};
      if (startDate) {
        matchConditions["createdAt"]["$gte"] = new Date(startDate);
      }
      if (endDate) {
        matchConditions["createdAt"]["$lte"] = new Date(endDate);
      }
    }

    // Filter by user IDs
    if (userIds) {
      let userIdArray;
      try {
        // Handle both JSON string and regular array/string
        if (typeof userIds === "string" && userIds.startsWith("[")) {
          userIdArray = JSON.parse(userIds);
        } else {
          userIdArray = Array.isArray(userIds) ? userIds : [userIds];
        }
        matchConditions["user_id"] = {
          $in: userIdArray.map((id) => new mongoose.Types.ObjectId(id)),
        };
      } catch (error) {
        console.error("Error parsing userIds:", error);
        return res.status(400).json({
          success: false,
          message: "Invalid userIds format",
        });
      }
    }

    const pipeline = [
      { $match: matchConditions },
      {
        $lookup: {
          from: "timelogs",
          localField: "_id",
          foreignField: "task_id",
          as: "timeLogs",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: "$timeLogs",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          workMinutes: {
            $cond: {
              if: { $and: ["$timeLogs.punchInTime", "$timeLogs.punchOutTime"] },
              then: {
                $divide: [
                  {
                    $subtract: [
                      "$timeLogs.punchOutTime",
                      "$timeLogs.punchInTime",
                    ],
                  },
                  60000,
                ],
              },
              else: 0,
            },
          },
          date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$timeLogs.punchInTime",
            },
          },
        },
      },
      {
        $group: {
          _id: {
            userId: "$user_id",
            userName: "$user.name",
            userEmail: "$user.email",
            date: "$date",
          },
          totalWorkMinutes: { $sum: "$workMinutes" },
          totalTasks: { $addToSet: "$_id" },
          totalLogs: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: {
            userId: "$_id.userId",
            userName: "$_id.userName",
            userEmail: "$_id.userEmail",
          },
          workDays: {
            $push: {
              date: "$_id.date",
              workMinutes: "$totalWorkMinutes",
              workHours: { $divide: ["$totalWorkMinutes", 60] },
              tasks: { $size: "$totalTasks" },
              logs: "$totalLogs",
            },
          },
          totalWorkMinutes: { $sum: "$totalWorkMinutes" },
          totalWorkDays: { $sum: 1 },
        },
      },
      {
        $sort: { totalWorkMinutes: -1 },
      },
    ];

    const results = await TaskModel.aggregate(pipeline);

    const summaryData = results.map((result) => ({
      user: {
        userId: result._id.userId,
        name: result._id.userName,
        email: result._id.userEmail,
      },
      summary: {
        totalWorkHours: formatWorkDuration(Math.round(result.totalWorkMinutes)),
        totalWorkMinutes: Math.round(result.totalWorkMinutes),
        totalWorkDays: result.totalWorkDays,
      },
      dailyBreakdown: result.workDays
        .filter((day) => day.date)
        .map((day) => ({
          date: day.date,
          workHours: formatWorkDuration(Math.round(day.workMinutes)),
          workMinutes: Math.round(day.workMinutes),
          totalTasks: day.tasks,
          totalLogs: day.logs,
        })),
    }));

    res.status(200).json({
      success: true,
      data: {
        dateRange: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
        userSummaries: summaryData,
        totalUsers: summaryData.length,
      },
    });
  } catch (error) {
    console.error("Error in getActivitySummaryByDateRange:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch activity summary",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

module.exports = {
  getActivityLogs,
  getUserActivityLogs,
  getActivitySummaryByDateRange,
};
