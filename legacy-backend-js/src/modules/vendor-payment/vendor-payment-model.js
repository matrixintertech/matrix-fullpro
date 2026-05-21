const mongoose = require("mongoose");

const Status = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
  SUBMITTED: "Submitted",
};

const vendorPaymentSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
    },
    po: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Po",
    },
    amount: { type: Number, required: true },
    approved_amount: { type: Number },
    attachment: { type: String },
    remarks: { type: String },
    status: {
      type: String,
      enum: Object.values(Status),
      default: Status.SUBMITTED,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestedAt: { type: Date, default: Date.now },
    approved_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approved_date: { type: Date },
    mark_as_paid_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    mark_as_paid_date: { type: Date },
    serviceRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceRequest",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("VendorPayment", vendorPaymentSchema);
