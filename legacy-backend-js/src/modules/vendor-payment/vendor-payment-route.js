const express = require("express");
const router = express.Router();
const {
  createPaymentRequest,
  getAllPaymentRequests,
  getPaymentRequestById,
  updatePaymentStatus,
  updateVendorPaymentStatus,
  getPaymentsByServiceRequestId,
  updatePaymentRequest,
  deletePaymentRequest,
} = require("./vendor-payment-controller");

// Create a new vendor payment request
router.post("/create-payment-request", createPaymentRequest);

// Get all vendor payment requests
router.get("/all", getAllPaymentRequests);

// Get a single payment request by ID, PO, or Bill ID
router.get("/get-by-id/:id?", getPaymentRequestById);

// Update payment status
router.post("/update-status/:id", updatePaymentStatus);

// Update vendor payment status
router.post("/update-vendor-status/:id", updateVendorPaymentStatus);

// Get vendor payments by service request
router.get("/get-by-service-request-id/:id", getPaymentsByServiceRequestId);

// Update vendor payment request
router.post("/update/:id", updatePaymentRequest);

// Delete vendor payment request
router.delete("/delete/:id", deletePaymentRequest);

module.exports = router;
