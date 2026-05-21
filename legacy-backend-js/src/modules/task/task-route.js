const express = require("express");
const router = express.Router();
const {
  createTask,
  getTaskByServiceId,
  updateTaskStatus,
  deleteTask,
  getTaskByQuery,
  getLastTaskId, // Add the new import
} = require("./task-controller");

router.post("/create-tasks", createTask);
router.get("/service/:serviceId", getTaskByServiceId);
router.post("/get-tasks-by-query", getTaskByQuery);
router.post("/update-by-Id/:id", updateTaskStatus);
router.delete("/delete/:id", deleteTask);
router.get("/last-task-id", getLastTaskId); // Get overall last TaskId
router.get("/last-task-id/:serviceRequestId", getLastTaskId); // Get last TaskId for specific service request

module.exports = router;
