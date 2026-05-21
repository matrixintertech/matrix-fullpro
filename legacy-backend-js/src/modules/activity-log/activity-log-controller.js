const { TaskModel } = require("../task/task-model");
const { TimeLog } = require("../timeLog/time-log-model");
const { UserModal } = require("../user/user-modal");
const mongoose = require("mongoose");
const puppeteer = require("puppeteer");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const path = require("path");
const fs = require("fs");

// Helper function to calculate work duration in minutes
const calculateWorkDuration = (punchIn, punchOut) => {
  if (!punchIn || !punchOut) return 0;
  return Math.round((new Date(punchOut) - new Date(punchIn)) / (1000 * 60));
};

// Helper function to format work duration with days
const formatWorkDuration = (minutes) => {
  if (!minutes || minutes === 0) return "0h 0m";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours}h ${mins}m`;
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
      filterBy = "taskCreated", // New parameter: "taskCreated" or "timeLog"
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

    // Filter by date range - Tasks created within this period OR filter by time log dates
    if (startDate || endDate) {
      if (filterBy === "timeLog") {
        // Will be applied after lookup in pipeline
        console.log("Date filtering will be applied to time logs");
      } else {
        // Default: Filter by task creation date
        matchConditions["createdAt"] = {};
        if (startDate) {
          matchConditions["createdAt"]["$gte"] = new Date(startDate);
        }
        if (endDate) {
          // Set end date to end of day to include all tasks created on that date
          const endOfDay = new Date(endDate);
          endOfDay.setHours(23, 59, 59, 999);
          matchConditions["createdAt"]["$lte"] = endOfDay;
        }
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
    // When date range is specified, it filters tasks by creation date
    // but returns ALL time logs (punch in/out) for those tasks regardless of when time logs were created
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
                  { $not: { $ifNull: ["$$this.punchOutTime", false] } },
                ],
              },
            },
          },
        },
      },
    ];

    // Only show tasks that have at least one time log (exclude tasks with no punch in/out data)
    pipeline.push({
      $match: {
        "timeLogs.0": { $exists: true }, // Only tasks with at least one time log
      },
    });

    // Filter time logs by date range if filterBy is "timeLog"
    if ((startDate || endDate) && filterBy === "timeLog") {
      const timeLogDateFilter = {};
      if (startDate) {
        timeLogDateFilter["$gte"] = new Date(startDate);
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        timeLogDateFilter["$lte"] = endOfDay;
      }

      pipeline.push({
        $addFields: {
          timeLogs: {
            $filter: {
              input: "$timeLogs",
              cond: {
                $and: [
                  {
                    $gte: [
                      "$$this.punchInTime",
                      timeLogDateFilter.$gte || new Date("1970-01-01"),
                    ],
                  },
                  {
                    $lte: [
                      "$$this.punchInTime",
                      timeLogDateFilter.$lte || new Date("2099-12-31"),
                    ],
                  },
                ],
              },
            },
          },
        },
      });

      // Remove tasks that have no time logs after filtering
      pipeline.push({
        $match: {
          "timeLogs.0": { $exists: true },
        },
      });
    }

    // Filter by active session if specified - MATCH CLIENT LOGIC EXACTLY
    if (activeSession && activeSession !== "all") {
      if (activeSession === "true") {
        // Only include tasks that have at least one time log with punch in but no punch out
        // This matches: activeTimeLogs.filter(log => log.isActive) where isActive = !timeLog.punchOutTime
        pipeline.push({
          $match: {
            timeLogs: {
              $elemMatch: {
                punchInTime: { $exists: true, $ne: null },
                punchOutTime: { $exists: false },
              },
            },
          },
        });
      } else if (activeSession === "false") {
        // Include tasks that have NO active sessions (all time logs have punchOutTime OR no time logs at all)
        pipeline.push({
          $match: {
            $expr: {
              $or: [
                // Tasks with no time logs at all
                { $eq: [{ $size: "$timeLogs" }, 0] },
                // Tasks where all time logs have punchOutTime (no active sessions)
                {
                  $eq: [
                    {
                      $size: {
                        $filter: {
                          input: "$timeLogs",
                          cond: {
                            $not: { $ifNull: ["$$this.punchOutTime", false] },
                          },
                        },
                      },
                    },
                    0,
                  ],
                },
              ],
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

    // Compute matched tasks (before pagination) from the same pipeline so
    // summary counts are consistent with the filters applied above
    const pipelineForSummary = [...pipeline];
    const matchedTasks = await TaskModel.aggregate(pipelineForSummary);

    // Derive consistent summary counts from matchedTasks
    let computedTotalLogs = 0;
    let computedActiveSessions = 0;
    let computedTotalWorkMinutes = 0;
    const uniqueUserSet = new Set();

    for (const t of matchedTasks) {
      const timeLogs = Array.isArray(t.timeLogs) ? t.timeLogs : [];
      const activeSessions = Array.isArray(t.activeSession)
        ? t.activeSession
        : [];

      // If activeSession filter is true, only count active sessions as logs
      if (activeSession === "true") {
        computedTotalLogs += activeSessions.length;
      } else {
        // Otherwise, count all time logs
        computedTotalLogs += timeLogs.length;
      }

      computedActiveSessions += activeSessions.length;
      computedTotalWorkMinutes += Math.round(t.totalWorkHours || 0);
      if (t.user_id) uniqueUserSet.add(String(t.user_id));
    }

    // Status counts derived from matchedTasks (so they follow filters)
    const statusCounts = matchedTasks.reduce((acc, t) => {
      const s = t.status || "";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    // Use computed values as defaults; these will be used later when building response
    var filteredTotalLogsCount = computedTotalLogs;
    var filteredActiveSessionsCount = computedActiveSessions;
    var filteredCompletedTasksCount = statusCounts["Completed"] || 0;
    var filteredInProgressTasksCount = statusCounts["In progress"] || 0;
    var filteredYetToStartTasksCount = statusCounts["Yet to start"] || 0;
    var filteredTotalWorkMinutes = computedTotalWorkMinutes;
    var filteredUniqueUsersCount = uniqueUserSet.size;

    // Add pagination to main pipeline
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limitNum });

    // Execute aggregation
    const tasks = await TaskModel.aggregate(pipeline);

    // Fetch all users for separate response
    const allUsers = await UserModal.find(
      {},
      {
        _id: 1,
        name: 1,
        email: 1,
        mobile: 1,
        profileImage: 1,
        role: 1,
        status: 1,
      }
    ).lean();

    // Format the response data
    const activityLogs = [];

    for (const task of tasks) {
      const baseActivity = {
        taskId: task._id,
        taskName: task.TaskId,
        taskTitle: task.title,
        taskDescription: task.description,
        taskStatus: task.status,
        taskDate: task.task_date,
        taskCreated: task.createdAt,
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
                    { $not: { $ifNull: ["$$this.punchOutTime", false] } },
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

    // Get total logs count, active sessions count, and task status counts
    // Use values computed from the filtered aggregation so summary respects filters
    let totalLogsCount = filteredTotalLogsCount;
    let activeSessionsCount = filteredActiveSessionsCount;
    let completedTasksCount = filteredCompletedTasksCount;
    let inProgressTasksCount = filteredInProgressTasksCount;
    let yetToStartTasksCount = filteredYetToStartTasksCount;

    // Prepare response
    const response = {
      success: true,
      data: {
        users: allUsers,
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
          totalTasks: matchedTasks.length,
          totalLogs: totalLogsCount,
          activeSessions: activeSessionsCount,
          completedTasks: completedTasksCount,
          inProgressTasks: inProgressTasksCount,
          yetToStartTasks: yetToStartTasksCount,
          totalWorkHours: formatWorkDuration(
            Math.round(filteredTotalWorkMinutes)
          ),
          totalWorkMinutes: Math.round(filteredTotalWorkMinutes),
          uniqueUsers: filteredUniqueUsersCount,
        },
        filters: {
          userIds: userIds || null,
          startDate: startDate || null,
          endDate: endDate || null,
          filterBy: filterBy || "taskCreated",
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

// Download activity logs as PDF
const downloadActivityLogsPDF = async (req, res) => {
  try {
    const {
      userIds,
      startDate,
      endDate,
      status,
      activeSession,
      search,
      filterBy = "taskCreated",
      serviceRequestId, // Filter by specific service request
    } = req.query;

    // Reuse the existing logic to get filtered data
    const tempReq = { query: req.query };
    const tempRes = {
      status: () => ({ json: (data) => data }),
      json: (data) => data,
    };

    // Get the activity logs data using existing function logic
    let matchConditions = {};

    // Filter by user IDs
    if (userIds) {
      let userIdArray;
      try {
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
      if (filterBy === "timeLog") {
        console.log("Date filtering will be applied to time logs");
      } else {
        matchConditions["createdAt"] = {};
        if (startDate) {
          matchConditions["createdAt"]["$gte"] = new Date(startDate);
        }
        if (endDate) {
          const endOfDay = new Date(endDate);
          endOfDay.setHours(23, 59, 59, 999);
          matchConditions["createdAt"]["$lte"] = endOfDay;
        }
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

    // Filter by service request ID
    if (serviceRequestId) {
      matchConditions["serviceRequestId"] = new mongoose.Types.ObjectId(
        serviceRequestId
      );
    }

    // Build aggregation pipeline
    const pipeline = [
      { $match: matchConditions },
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
        },
      },
      {
        $match: {
          "timeLogs.0": { $exists: true },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
    ];

    // Apply time log date filtering if needed
    if ((startDate || endDate) && filterBy === "timeLog") {
      const timeLogDateFilter = {};
      if (startDate) {
        timeLogDateFilter["$gte"] = new Date(startDate);
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        timeLogDateFilter["$lte"] = endOfDay;
      }

      pipeline.push({
        $addFields: {
          timeLogs: {
            $filter: {
              input: "$timeLogs",
              cond: {
                $and: [
                  {
                    $gte: [
                      "$$this.punchInTime",
                      timeLogDateFilter.$gte || new Date("1970-01-01"),
                    ],
                  },
                  {
                    $lte: [
                      "$$this.punchInTime",
                      timeLogDateFilter.$lte || new Date("2099-12-31"),
                    ],
                  },
                ],
              },
            },
          },
        },
      });

      pipeline.push({
        $match: {
          "timeLogs.0": { $exists: true },
        },
      });
    }

    // Apply active session filter
    if (activeSession && activeSession !== "all") {
      if (activeSession === "true") {
        pipeline.push({
          $match: {
            timeLogs: {
              $elemMatch: {
                punchInTime: { $exists: true, $ne: null },
                punchOutTime: { $exists: false },
              },
            },
          },
        });
      } else if (activeSession === "false") {
        pipeline.push({
          $match: {
            $expr: {
              $or: [
                { $eq: [{ $size: "$timeLogs" }, 0] },
                {
                  $eq: [
                    {
                      $size: {
                        $filter: {
                          input: "$timeLogs",
                          cond: {
                            $not: { $ifNull: ["$$this.punchOutTime", false] },
                          },
                        },
                      },
                    },
                    0,
                  ],
                },
              ],
            },
          },
        });
      }
    }

    const tasks = await TaskModel.aggregate(pipeline);
    console.log(`Found ${tasks.length} tasks for PDF generation`);

    // Get user information for filters display
    let selectedUsers = [];
    if (userIds) {
      try {
        let userIdArray;
        if (typeof userIds === "string" && userIds.startsWith("[")) {
          userIdArray = JSON.parse(userIds);
        } else {
          userIdArray = Array.isArray(userIds) ? userIds : [userIds];
        }
        selectedUsers = await UserModal.find(
          {
            _id: {
              $in: userIdArray.map((id) => new mongoose.Types.ObjectId(id)),
            },
          },
          { name: 1, email: 1 }
        ).lean();
      } catch (error) {
        console.error("Error fetching user details:", error);
      }
    }

    // Check if we have data to generate PDF
    if (!tasks || tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No activity logs found for the specified filters",
      });
    }

    // Format data for PDF
    const activityData = [];
    for (const task of tasks) {
      for (const timeLog of task.timeLogs) {
        const workDuration = calculateWorkDuration(
          timeLog.punchInTime,
          timeLog.punchOutTime
        );

        // Helper function to escape HTML characters
        const escapeHtml = (text) => {
          if (!text) return "N/A";
          return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
        };

        activityData.push({
          serviceRequest:
            escapeHtml(task.serviceRequest?.serviceRequestId) || "N/A",
          serviceRequestTitle: escapeHtml(task.serviceRequest?.title) || "N/A",
          serviceNumber:
            escapeHtml(task.serviceRequest?.serviceNumber) || "N/A",
          taskId: escapeHtml(task.TaskId),
          taskTitle: escapeHtml(task.title),
          taskDescription: escapeHtml(task.description),
          taskStatus: escapeHtml(task.status),
          assignedTo: escapeHtml(task.assignedUser?.name) || "Unassigned",
          assignedEmail: escapeHtml(task.assignedUser?.email) || "N/A",
          punchIn: timeLog.punchInTime
            ? new Date(timeLog.punchInTime).toLocaleString()
            : "N/A",
          punchOut: timeLog.punchOutTime
            ? new Date(timeLog.punchOutTime).toLocaleString()
            : "Active",
          workHours: formatWorkDuration(workDuration),
          workMinutes: workDuration,
          punchInLocation: escapeHtml(timeLog.punchInLocation),
          punchOutLocation: escapeHtml(timeLog.punchOutLocation),
          taskCreated: new Date(task.createdAt).toLocaleString(),
        });
      }
    }

    // Check if we have activity data
    if (activityData.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "No activity data found with time logs for the specified filters",
      });
    }

    // Calculate dashboard stats for PDF header using the already-fetched
    // `tasks` array so the PDF respects the same filters used above.
    let totalTimeLogs = 0;
    let activeSessionsCount = 0;
    let completedTasks = 0;
    let inProgressTasks = 0;
    let yetToStartTasks = 0;
    let totalWorkMinutes = 0;
    const totalTasks = tasks.length;

    for (const tk of tasks) {
      const logs = Array.isArray(tk.timeLogs) ? tk.timeLogs : [];
      const activeLogs = logs.filter(
        (l) =>
          l.punchInTime &&
          (l.punchOutTime === null || l.punchOutTime === undefined)
      );

      // If activeSession filter is true, only count active sessions as logs
      if (activeSession === "true") {
        totalTimeLogs += activeLogs.length;
      } else {
        totalTimeLogs += logs.length;
      }

      // Count active sessions (punchIn exists and punchOut missing/null)
      activeSessionsCount += activeLogs.length;

      // Sum work minutes for time logs with punchIn and punchOut
      for (const l of logs) {
        if (l.punchInTime && l.punchOutTime) {
          totalWorkMinutes += calculateWorkDuration(
            l.punchInTime,
            l.punchOutTime
          );
        }
      }

      // Status counts
      const st = tk.status;
      if (st === "Completed") completedTasks += 1;
      else if (st === "In progress") inProgressTasks += 1;
      else if (st === "Yet to start") yetToStartTasks += 1;
    }

    // Limit data for large datasets to prevent memory issues
    const maxRecords = 1000;
    if (activityData.length > maxRecords) {
      console.log(
        `Limiting PDF data from ${activityData.length} to ${maxRecords} records`
      );
      activityData.splice(maxRecords);
    }

    // Generate HTML for PDF with safer content handling
    const generateTableRows = () => {
      try {
        return activityData
          .slice(0, 100) // Limit to first 100 rows for main PDF
          .map((row) => {
            // Truncate long text to prevent layout issues
            const truncate = (text, maxLength = 30) => {
              if (!text) return "N/A";
              return text.length > maxLength
                ? text.substring(0, maxLength) + "..."
                : text;
            };
            return `
                    <tr>
                        <td>${
                          row.serviceNumber || row.serviceRequest || "N/A"
                        }</td>
                        <td>${truncate(row.taskId)}</td>
                        <td>${truncate(row.taskTitle, 40)}</td>
                        <td>${truncate(row.taskStatus)}</td>
                        <td>${truncate(row.assignedTo)}</td>
                        <td>${truncate(row.punchIn, 20)}</td>
                        <td class="${
                          row.punchOut === "Active"
                            ? "active-session"
                            : "completed-session"
                        }">${truncate(row.punchOut, 20)}</td>
                        <td>${truncate(row.workHours)}</td>
                        <td>${truncate(row.punchInLocation, 25)}</td>
                        <td>${truncate(row.taskCreated, 20)}</td>
                    </tr>`;
          })
          .join("");
      } catch (error) {
        console.error("Error generating table rows:", error);
        return '<tr><td colspan="10">Error generating data</td></tr>';
      }
    };

    // Create comprehensive HTML content with stats and all filters
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Activity Logs Report</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 15px;
            font-size: 11px;
            line-height: 1.3;
        }
        .header { 
            text-align: center; 
            margin-bottom: 20px;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 15px;
            font-size: 10px;
        }
        .stat-card {
            background-color: #f8f9fa;
            padding: 8px;
            border-radius: 4px;
            text-align: center;
            border: 1px solid #dee2e6;
        }
        .stat-number {
            font-size: 14px;
            font-weight: bold;
            color: #495057;
        }
        .stat-label {
            font-size: 9px;
            color: #6c757d;
            margin-top: 2px;
        }
        .filters {
            background-color: #e3f2fd;
            padding: 12px;
            margin-bottom: 15px;
            font-size: 10px;
            border-radius: 4px;
        }
        .filter-section {
            margin-bottom: 8px;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 8px;
            table-layout: fixed;
        }
        th, td { 
            border: 1px solid #ccc; 
            padding: 4px; 
            text-align: left;
            vertical-align: top;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        th { 
            background-color: #e9ecef; 
            font-weight: bold;
            font-size: 8px;
        }
        tr:nth-child(even) { 
            background-color: #f8f9fa; 
        }
        .active-session { color: #dc3545; font-weight: bold; }
        .completed-session { color: #28a745; }
        .summary {
            margin-top: 15px;
            padding: 12px;
            background-color: #fff3cd;
            font-size: 10px;
            border-radius: 4px;
            border: 1px solid #ffeaa7;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Activity Logs Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-number">${totalTimeLogs}</div>
            <div class="stat-label">Total Time Logs</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${activeSessionsCount}</div>
            <div class="stat-label">Active Sessions</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${formatWorkDuration(
              Math.round(totalWorkMinutes)
            )}</div>
            <div class="stat-label">Total Work Hours</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${totalTasks}</div>
            <div class="stat-label">Total Tasks</div>
        </div>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-number">${completedTasks}</div>
            <div class="stat-label">Completed Tasks</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${inProgressTasks}</div>
            <div class="stat-label">In Progress Tasks</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${yetToStartTasks}</div>
            <div class="stat-label">Yet to Start Tasks</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${Math.min(activityData.length, 100)}</div>
            <div class="stat-label">Records in Report</div>
        </div>
    </div>
    
    <div class="filters">
        <div class="filter-section">
            <strong>Applied Filters:</strong>
        </div>
        <div class="filter-section">
            <strong>Date Range:</strong> ${startDate || "All"} to ${
      endDate || "All"
    }
        </div>
        <div class="filter-section">
            <strong>Filter By:</strong> ${filterBy || "Task Created"}
        </div>
        <div class="filter-section">
            <strong>Task Status:</strong> ${status || "All"}
        </div>
        <div class="filter-section">
            <strong>Active Session:</strong> ${activeSession || "All"}
        </div>
        <div class="filter-section">
            <strong>Search Query:</strong> ${search || "None"}
        </div>
        ${
          serviceRequestId
            ? `<div class="filter-section"><strong>Service Request:</strong> ${serviceRequestId}</div>`
            : ""
        }
        ${
          selectedUsers.length > 0
            ? `<div class="filter-section"><strong>Selected Users:</strong> ${selectedUsers
                .map((u) => u.name)
                .join(", ")}</div>`
            : '<div class="filter-section"><strong>Users:</strong> All Users</div>'
        }
        ${
          activityData.length > 100
            ? `<div class="filter-section"><strong>Note:</strong> Showing first 100 of ${activityData.length} records</div>`
            : ""
        }
    </div>

    <table>
        <thead>
            <tr>
                <th width="18%">Service Number</th>
                <th width="8%">Task ID</th>
                <th width="12%">Task Title</th>
                <th width="8%">Status</th>
                <th width="10%">Assigned To</th>
                <th width="10%">Punch In</th>
                <th width="10%">Punch Out</th>
                <th width="6%">Work Hours</th>
                <th width="12%">Location</th>
                <th width="6%">Created</th>
            </tr>
        </thead>
        <tbody>
            ${generateTableRows()}
        </tbody>
    </table>

    <div class="summary">
        <strong>Report Summary:</strong> 
        This report contains ${Math.min(
          activityData.length,
          100
        )} activity records from ${tasks.length} tasks. 
        Active sessions: ${
          activityData.filter((row) => row.punchOut === "Active").length
        }. 
        Total work time in filtered data: ${formatWorkDuration(
          activityData.reduce((total, row) => total + (row.workMinutes || 0), 0)
        )} hours.
        Generated from Matrix CRM Activity Log system.
    </div>
</body>
</html>`;

    // Generate PDF using Puppeteer with enhanced error handling
    let browser;
    try {
      console.log("Launching Puppeteer browser...");
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--max_old_space_size=4096",
        ],
      });

      console.log("Creating new page...");
      const page = await browser.newPage();

      // Set a reasonable timeout and viewport
      page.setDefaultTimeout(60000);
      await page.setViewport({ width: 1200, height: 800 });

      // Set user agent to avoid detection
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      );

      // Set content with simpler options
      await page.setContent(htmlContent, {
        waitUntil: "load",
        timeout: 45000,
      });

      // Wait for content to settle
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const pdfBuffer = await page.pdf({
        format: "A3", // Use A3 for wider content
        landscape: true,
        margin: {
          top: "10px",
          right: "10px",
          bottom: "10px",
          left: "10px",
        },
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        scale: 0.75, // Smaller scale to fit more content
      });

      // Validate PDF buffer
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error("Generated PDF buffer is empty");
      }

      // Debug PDF buffer content
      const pdfHeader = pdfBuffer.slice(0, 10).toString();

      // More lenient PDF validation - check for PDF signature anywhere in first 1024 bytes
      const first1KB = pdfBuffer.slice(0, 1024).toString();
      const hasPdfSignature =
        first1KB.includes("%PDF") || first1KB.includes("PDF");

      if (!hasPdfSignature) {
        console.log(
          "Warning: PDF signature not found in first 1KB, but proceeding anyway"
        );
        console.log(
          `Buffer content preview: ${pdfBuffer.slice(0, 100).toString()}`
        );
      }

      // Set response headers for PDF download
      const filename = `activity-logs-${
        new Date().toISOString().split("T")[0]
      }.pdf`;

      // Clear any previous headers
      res.removeHeader("Content-Encoding");

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader("Content-Length", pdfBuffer.length);
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      // Send the PDF buffer (bypassing strict validation for now)
      res.end(pdfBuffer, "binary");
    } catch (pdfError) {
      console.error("Complex PDF generation error:", pdfError);

      // Fallback: Create a very simple PDF
      try {
        const fallbackHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Activity Logs Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
        h1 { color: #333; text-align: center; }
        .info { background: #f5f5f5; padding: 10px; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Activity Logs Report</h1>
    <div class="info">
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Total Records:</strong> ${activityData.length}</p>
        <p><strong>Note:</strong> Simplified view due to data complexity</p>
    </div>
    <table>
        <thead>
            <tr><th>Task ID</th><th>Title</th><th>Status</th><th>Assigned To</th><th>Work Hours</th></tr>
        </thead>
        <tbody>
            ${activityData
              .slice(0, 50)
              .map(
                (row) => `
                <tr>
                    <td>${(row.taskId || "N/A").substring(0, 20)}</td>
                    <td>${(row.taskTitle || "N/A").substring(0, 30)}</td>
                    <td>${row.taskStatus || "N/A"}</td>
                    <td>${(row.assignedTo || "N/A").substring(0, 20)}</td>
                    <td>${row.workHours || "N/A"}</td>
                </tr>
            `
              )
              .join("")}
        </tbody>
    </table>
    ${
      activityData.length > 50
        ? `<p><em>Showing first 50 of ${activityData.length} records</em></p>`
        : ""
    }
</body>
</html>`;

        const fallbackPage = await browser.newPage();
        await fallbackPage.setContent(fallbackHtml);
        const fallbackPdfBuffer = await fallbackPage.pdf({
          format: "A4",
          printBackground: true,
          margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
        });

        console.log(
          `Fallback PDF generated. Size: ${fallbackPdfBuffer.length} bytes`
        );

        // Validate fallback PDF
        if (!fallbackPdfBuffer || fallbackPdfBuffer.length === 0) {
          throw new Error("Fallback PDF buffer is empty");
        }

        // Debug fallback PDF buffer
        const fallbackPdfHeader = fallbackPdfBuffer.slice(0, 10).toString();
        console.log(`Fallback PDF buffer header: "${fallbackPdfHeader}"`);

        // More lenient validation for fallback too
        const fallbackFirst1KB = fallbackPdfBuffer.slice(0, 1024).toString();
        const fallbackHasPdfSignature =
          fallbackFirst1KB.includes("%PDF") || fallbackFirst1KB.includes("PDF");

        if (!fallbackHasPdfSignature) {
          console.log(
            "Warning: Fallback PDF signature not found, but proceeding anyway"
          );
        }

        // Send fallback PDF
        const filename = `activity-logs-simplified-${
          new Date().toISOString().split("T")[0]
        }.pdf`;
        res.removeHeader("Content-Encoding");
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );
        res.setHeader("Content-Length", fallbackPdfBuffer.length);
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.end(fallbackPdfBuffer, "binary");
        return; // Exit successfully with fallback PDF
      } catch (fallbackError) {
        console.error("Fallback PDF generation also failed:", fallbackError);
        throw new Error(
          `Both main and fallback PDF generation failed: ${pdfError.message}`
        );
      }
    } finally {
      if (browser) {
        console.log("Closing browser...");
        await browser.close();
      }
    }
  } catch (error) {
    console.error("Error in downloadActivityLogsPDF:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate PDF",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Download activity logs as CSV
const downloadActivityLogsCSV = async (req, res) => {
  try {
    const {
      userIds,
      startDate,
      endDate,
      status,
      activeSession,
      search,
      filterBy = "taskCreated",
      serviceRequestId, // Filter by specific service request
    } = req.query;

    // Reuse the same filtering logic as PDF function
    let matchConditions = {};

    // Filter by user IDs
    if (userIds) {
      let userIdArray;
      try {
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
      if (filterBy === "timeLog") {
        console.log("Date filtering will be applied to time logs");
      } else {
        matchConditions["createdAt"] = {};
        if (startDate) {
          matchConditions["createdAt"]["$gte"] = new Date(startDate);
        }
        if (endDate) {
          const endOfDay = new Date(endDate);
          endOfDay.setHours(23, 59, 59, 999);
          matchConditions["createdAt"]["$lte"] = endOfDay;
        }
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

    // Filter by service request ID
    if (serviceRequestId) {
      matchConditions["serviceRequestId"] = new mongoose.Types.ObjectId(
        serviceRequestId
      );
    }

    // Build aggregation pipeline (same as PDF)
    const pipeline = [
      { $match: matchConditions },
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
        },
      },
      {
        $match: {
          "timeLogs.0": { $exists: true },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
    ];

    // Apply time log date filtering if needed
    if ((startDate || endDate) && filterBy === "timeLog") {
      const timeLogDateFilter = {};
      if (startDate) {
        timeLogDateFilter["$gte"] = new Date(startDate);
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        timeLogDateFilter["$lte"] = endOfDay;
      }

      pipeline.push({
        $addFields: {
          timeLogs: {
            $filter: {
              input: "$timeLogs",
              cond: {
                $and: [
                  {
                    $gte: [
                      "$$this.punchInTime",
                      timeLogDateFilter.$gte || new Date("1970-01-01"),
                    ],
                  },
                  {
                    $lte: [
                      "$$this.punchInTime",
                      timeLogDateFilter.$lte || new Date("2099-12-31"),
                    ],
                  },
                ],
              },
            },
          },
        },
      });

      pipeline.push({
        $match: {
          "timeLogs.0": { $exists: true },
        },
      });
    }

    // Apply active session filter
    if (activeSession && activeSession !== "all") {
      if (activeSession === "true") {
        pipeline.push({
          $match: {
            timeLogs: {
              $elemMatch: {
                punchInTime: { $exists: true, $ne: null },
                punchOutTime: { $exists: false },
              },
            },
          },
        });
      } else if (activeSession === "false") {
        pipeline.push({
          $match: {
            $expr: {
              $or: [
                { $eq: [{ $size: "$timeLogs" }, 0] },
                {
                  $eq: [
                    {
                      $size: {
                        $filter: {
                          input: "$timeLogs",
                          cond: {
                            $not: { $ifNull: ["$$this.punchOutTime", false] },
                          },
                        },
                      },
                    },
                    0,
                  ],
                },
              ],
            },
          },
        });
      }
    }

    const tasks = await TaskModel.aggregate(pipeline);

    // Format data for CSV
    const csvData = [];
    for (const task of tasks) {
      for (const timeLog of task.timeLogs) {
        const workDuration = calculateWorkDuration(
          timeLog.punchInTime,
          timeLog.punchOutTime
        );

        csvData.push({
          serviceRequest: task.serviceRequest?.serviceRequestId || "N/A",
          serviceNumber: task.serviceRequest?.serviceNumber || "N/A",
          serviceRequestTitle: task.serviceRequest?.title || "N/A",
          taskId: task.TaskId,
          taskTitle: task.title,
          taskDescription: task.description,
          taskStatus: task.status,
          assignedTo: task.assignedUser?.name || "Unassigned",
          assignedEmail: task.assignedUser?.email || "N/A",
          punchIn: timeLog.punchInTime
            ? new Date(timeLog.punchInTime).toLocaleString()
            : "N/A",
          punchOut: timeLog.punchOutTime
            ? new Date(timeLog.punchOutTime).toLocaleString()
            : "Active",
          workHours: formatWorkDuration(workDuration),
          workMinutes: workDuration,
          punchInLocation: timeLog.punchInLocation || "N/A",
          punchOutLocation: timeLog.punchOutLocation || "N/A",
          taskCreated: new Date(task.createdAt).toLocaleString(),
          isActiveSession: !timeLog.punchOutTime ? "Yes" : "No",
        });
      }
    }

    // Create temporary CSV file
    const filename = `activity-logs-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    const tempFilePath = path.join(__dirname, "../../temp", filename);

    // Ensure temp directory exists
    const tempDir = path.dirname(tempFilePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Define CSV writer
    const csvWriter = createCsvWriter({
      path: tempFilePath,
      header: [
        { id: "serviceRequest", title: "Service Request ID" },
        { id: "serviceNumber", title: "Service Number" },
        { id: "serviceRequestTitle", title: "Service Request Title" },
        { id: "taskId", title: "Task ID" },
        { id: "taskTitle", title: "Task Title" },
        { id: "taskDescription", title: "Task Description" },
        { id: "taskStatus", title: "Task Status" },
        { id: "assignedTo", title: "Assigned To" },
        { id: "assignedEmail", title: "Assigned Email" },
        { id: "punchIn", title: "Punch In" },
        { id: "punchOut", title: "Punch Out" },
        { id: "workHours", title: "Work Hours" },
        { id: "workMinutes", title: "Work Minutes" },
        { id: "punchInLocation", title: "Punch In Location" },
        { id: "punchOutLocation", title: "Punch Out Location" },
        { id: "taskCreated", title: "Task Created" },
        { id: "isActiveSession", title: "Is Active Session" },
      ],
    });

    // Write CSV file
    await csvWriter.writeRecords(csvData);

    // Set response headers for CSV download
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Stream the file to response
    const fileStream = fs.createReadStream(tempFilePath);
    fileStream.pipe(res);

    // Clean up temp file after streaming
    fileStream.on("end", () => {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error("Error deleting temp file:", err);
      });
    });
  } catch (error) {
    console.error("Error in downloadActivityLogsCSV:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate CSV",
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
  downloadActivityLogsPDF,
  downloadActivityLogsCSV,
};
