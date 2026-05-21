const mongoose = require("mongoose");

const Status = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
};
const PaymentSchema = new mongoose.Schema(
  {
    servicePartnerId: {
      type: mongoose.Types.ObjectId,
      ref: "ServicePartner",
    },
    serviceRequestId: {
      type: mongoose.Types.ObjectId,
      ref: "ServiceRequest",
      required: true,
    },
    user_id: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    approved_amount: {
      type: Number,
    },
    remark: {
      type: String,
    },
    desc: {
      type: String,
      required: true,
    },
    paymentStatus: {
      type: String,
      required: true,
      default: Status.REQUESTED,
    },
    approved_by: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
    approved_date: {
      type: Date,
    },
    mark_as_paid_by: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
    mark_as_paid_date: {
      type: Date,
    },
    paymentsRemarks: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const PaymentModel = mongoose.model("Payments", PaymentSchema);

module.exports = { PaymentModel, Status };
