// Import necessary modules
const mongoose = require("mongoose");

require("dotenv").config();

const Status = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REVISE: "Revise",
  UPDATED: "Updated",
  ASSIGNED: "Assigned",
  COMPLETED: "Completed",
  APPROVAL_PENDING: "Approval_Pending",
  WORK_IN_PROGRESS: "Work_In_Progress",
  // CANCELLED: "Cancelled",
};

const ServiceRequestSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Types.ObjectId, ref: "Client" },
    clientUserId: { type: mongoose.Types.ObjectId, ref: "ClientUser" },
    call_reference_number: { type: String },
    servicePartnerId: { type: mongoose.Types.ObjectId, ref: "ServicePartner" },
    createdByservicePartnerUserId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    }, // Added field
    createdByclientUserId: { type: mongoose.Types.ObjectId, ref: "ClientUser" },
    title: { type: String, required: true },
    cost_name: { type: String },
    description: { type: String },
    serviceNumber: { type: String, required: true, unique: true },
    serviceType: { type: String, required: true },
    beforeImages: [{ type: mongoose.Schema.Types.Mixed }],
    afterImages: [{ type: mongoose.Schema.Types.Mixed }],
    pmAssigned: { type: mongoose.Types.ObjectId, ref: "User" },
    pmAssignedStatus: { type: String, default: Status.PENDING },
    smAssigned: { type: mongoose.Types.ObjectId, ref: "User" },
    smAssignedStatus: { type: String, default: Status.PENDING },
    quotation: {
      type: mongoose.Types.ObjectId,
      ref: "Quotation",
    },
    branch_id: {
      type: mongoose.Types.ObjectId,
      ref: "Branch",
    },
    users: [
      {
        type: mongoose.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],
    teamMembers: [
      {
        type: mongoose.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],
    quotationCreatedStatus: {
      type: String,
      enum: Object.values(Status),
      default: Status.PENDING,
    },
    quotationApprovalStatus: {
      type: String,
      enum: Object.values(Status),
      default: Status.PENDING,
    },
    call_date_time: { type: Date },
    quotationUpdatedAt: { type: Date },
    taskCompletionStatus: {
      type: String,
      enum: Object.values(Status),
      default: Status.PENDING,
    },
    serviceCreatedDate: { type: Date },
    approveQuotationDate: { type: Date },
    // ServiceTargetStatusDate: { type: Date },
    // ServiceTargetStatusRemarks: { type: String },
    serviceRequestedDate: { type: Date }, // Newly added field
    ServiceTargetStatusLog: [
      {
        status: { type: String, enum: Object.values(Status) },
        date: { type: Date, default: Date.now },
        remarks: { type: String },
        user_id: {
          type: mongoose.Types.ObjectId,
          ref: "User",
        },
        targetDate: { type: Date },
        StartingTargetDate: { type: Date },
      },
    ],
  },
  {
    timestamps: true,
  }
);
const ServiceRequestModal = mongoose.model(
  "ServiceRequest",
  ServiceRequestSchema
);

module.exports = { ServiceRequestModal, Status };
