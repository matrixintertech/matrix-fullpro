const { TimeLog } = require("./time-log-model");
const { TaskModel } = require("../task/task-model");
const moment = require("moment-timezone");
// Create a new TimeLog
const createTimeLog = async (req, res) => {
  try {
    const timeLog = new TimeLog(req.body);
    await timeLog.save();
    res.status(201).json({ message: "Log Created Successfully" });
  } catch (error) {
    res.status(400).json({ message: `Error Creating Time Log ${error}` });
  }
};

// Get TimeLogs by service request ID
const getTimeLogsByServiceId = async (req, res) => {
  try {
    const timeLogs = await TimeLog.find({
      serviceRequestId: req.params.serviceRequestId,
    })
      .populate(["serviceRequestId", "user_id"])
      .sort({ createdAt: -1 });
    res.status(200).send(timeLogs);
  } catch (error) {
    res.status(500).json({ message: `Error Getting Time Log ${error}` });
  }
};

// Delete a TimeLog by ID
const deleteTimeLog = async (req, res) => {
  try {
    const timeLog = await TimeLog.findByIdAndDelete(req.params.id);
    if (!timeLog) {
      return res.status(404).send();
    }
    res.status(200).send(timeLog);
  } catch (error) {
    res.status(500).json({
      message: `Error Deleting Time Log ${error}`,
      error: error.message,
    });
  }
};

const punchIn = async (req, res) => {
  try {
    const { serviceRequestId, user_id, punchInLocation, task_id } = req.body;

    // Get the start of the day in IST (Indian Standard Time)
    const startOfDay = moment().startOf("day").locale("en-in").format();

    const endOfDay = moment().endOf("day").locale("en-in").format();

    const existingTimeLog = await TimeLog.findOne({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });
    // if (existingTimeLog?.punchInTime && !existingTimeLog?.punchOutTime) {
    //   return res
    //     .status(400)
    //     .json({ message: "You have already punched in today." });
    // }

    const punchInTime = moment().locale("en-in").format();

    const timeLog = new TimeLog({
      serviceRequestId,
      user_id,
      punchInTime,
      punchInLocation,
      task_id,
    });

    await timeLog.save();
    res.status(201).json({ message: "Punch-In Successful", timeLog });
  } catch (error) {
    res.status(400).json({ message: `Error Creating Punch-In ${error}` });
  }
};

// Update Punch-Out Time
const punchOut = async (req, res) => {
  try {
    const { timeLogId, user_id, punchOutLocation } = req.body;

    const timeLog = await TimeLog.findById(timeLogId);
    if (!timeLog) {
      return res.status(404).json({ message: "Time Log not found" });
    }

    if (timeLog.punchOutTime) {
      return res.status(400).json({ message: "You have already punched out." });
    }

    const punchOutTime = moment().locale("en-in").format();

    timeLog.punchOutTime = new Date(punchOutTime);
    timeLog.punchOutLocation = punchOutLocation;
    timeLog.user_id = user_id;
    await timeLog.save();
    res.status(200).json({ message: "Punch-Out Successful", timeLog });
  } catch (error) {
    res.status(400).json({ message: `Error Updating Punch-Out ${error}` });
  }
};

// Get Task and TimeLogs by Task ID
const getTaskAndTimeLogsByTaskId = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({ message: "Task ID is required" });
    }

    // Find task by ID or TaskId field
    const task = await TaskModel.findOne({
      $or: [{ _id: taskId }, { TaskId: taskId }],
    })
      .populate("serviceRequestId")
      .populate("user_id")
      .populate("created_by")
      .populate("logs.updated_by");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Find all time logs for this task
    const timeLogs = await TimeLog.find({
      task_id: task._id,
    })
      .populate("user_id")
      .populate("serviceRequestId")
      .populate("task_id")
      .sort({ createdAt: -1 });

    // Calculate total work duration from time logs
    let totalWorkMinutes = 0;
    const activeSessions = [];

    timeLogs.forEach((log) => {
      if (log.punchInTime && log.punchOutTime) {
        const duration = Math.round(
          (new Date(log.punchOutTime) - new Date(log.punchInTime)) / (1000 * 60)
        );
        totalWorkMinutes += duration;
      } else if (log.punchInTime && !log.punchOutTime) {
        // Active session (punched in but not out)
        activeSessions.push(log);
      }
    });

    const totalWorkHours = Math.floor(totalWorkMinutes / 60);
    const remainingMinutes = totalWorkMinutes % 60;

    res.status(200).json({
      success: true,
      data: {
        task,
        timeLogs,
        summary: {
          totalTimeLogs: timeLogs.length,
          activeSessions: activeSessions.length,
          totalWorkMinutes,
          totalWorkHours: `${totalWorkHours}h ${remainingMinutes}m`,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching task and time logs:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching task and time logs",
      error: error.message,
    });
  }
};

module.exports = {
  createTimeLog,
  punchIn,
  punchOut,
  getTimeLogsByServiceId,
  getTaskAndTimeLogsByTaskId,
  deleteTimeLog,
};
