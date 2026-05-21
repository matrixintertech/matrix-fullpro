const express = require("express");
const router = express.Router();
const AssignServiceController = require("./assign-service-controller");

router.post("/create-assignment", AssignServiceController.createAssignment);

router.get("/get-all-assignments", AssignServiceController.getAllAssignments);

router.get(
  "/assignments/service/:serviceId",
  AssignServiceController.getAssignmentsByServiceId
);

router.post(
  "/assignments/:assignmentId",
  AssignServiceController.updateAssignmentById
);

router.delete(
  "/assignments/:assignmentId",
  AssignServiceController.deleteAssignmentById
);

module.exports = router;
