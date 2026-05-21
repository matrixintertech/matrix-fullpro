const express = require("express");
const router = express.Router();
const {
  getActivityLogs,
  getUserActivityLogs,
  getActivitySummaryByDateRange,
  downloadActivityLogsPDF,
  downloadActivityLogsCSV,
  testPDFGeneration,
  debugActivityLogsHTML,
  simpleActivityLogsPDF,
  debugPDFBuffer,
} = require("./activity-log-controller");

// Middleware for authentication (uncomment if needed)
// const auth = require("../../middleware/auth");

router.get("/", getActivityLogs);

router.get("/user/:userId", getUserActivityLogs);

router.get("/summary", getActivitySummaryByDateRange);

// Download routes
router.get("/download/pdf", downloadActivityLogsPDF);
router.get("/download/csv", downloadActivityLogsCSV);



module.exports = router;
