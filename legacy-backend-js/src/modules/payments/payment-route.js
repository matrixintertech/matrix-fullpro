const express = require("express");
const router = express.Router();
const {
  createPayment,
  getPaymentByServiceId,
  updatePaymentStatus,
  getPaymentsByQuery,
  deletePayments,
} = require("./payment-controller");
router.post("/create-payments", createPayment);
router.get("/service/:serviceId", getPaymentByServiceId);
router.post("/update-by-Id/:id", updatePaymentStatus);
router.delete("/delete-by-Id/:id", deletePayments);
router.post("/get-by-query", getPaymentsByQuery);

module.exports = router;
