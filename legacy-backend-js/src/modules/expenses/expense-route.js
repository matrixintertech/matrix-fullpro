const express = require("express");
const router = express.Router();
const {
  createExpense,
  getExpenseByServiceId,
  updateExpenseStatus,
  getLedger,
  getExpensesByQuery,
  deleteExpense,
  getLastExpenseId, // Add the new import
} = require("./expense-controller");
router.post("/create-expenses", createExpense);
router.get("/service/:serviceId", getExpenseByServiceId);
router.get("/get-by-query", getExpensesByQuery);
router.post("/update-by-Id/:id", updateExpenseStatus);
router.delete("/delete-by-Id/:id", deleteExpense);
router.post("/get-ledger", getLedger);
router.get("/last-expense-id", getLastExpenseId); // Get overall last ExpenseId
router.get("/last-expense-id/:serviceRequestId", getLastExpenseId); // Get last ExpenseId for specific service request

module.exports = router;
