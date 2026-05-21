const mongoose = require("mongoose");

const QuotationSchema = new mongoose.Schema(
  {
    serviceRequestId: {
      type: mongoose.Types.ObjectId,
      ref: "ServiceRequest",
      required: true,
    },
    quotationNumber: { type: String, required: true, unique: true },
    rcs: [
      {
        rc_id: {
          type: mongoose.Types.ObjectId,
          ref: "Rc",
          required: true,
        },
        qty: {
          type: Number,
          required: true,
        },
        usedQty: {
          type: Number,
          default: 0,
        },
        completionStatus: {
          type: Boolean,
          default: false,
        },
        completionDate: {
          type: Date,
        },
        remarks: {
          type: String,
        },
        rate: {
          type: Number,
        },
        additional_description: String,
      },
    ],
    non_rcs: [
      {
        inventory_id: {
          type: mongoose.Types.ObjectId,
          ref: "Item",
          required: true,
        },
        qty: {
          type: Number,
          required: true,
        },
        usedQty: {
          type: Number,
          default: 0,
        },
        completionStatus: {
          type: Boolean,
          default: false,
        },
        completionDate: {
          type: Date,
        },
        rate: {
          type: Number,
        },
        remarks: {
          type: String,
        },
        additional_description: String,
      },
    ],
    total_amount: { type: Number, required: true },
    cgst: { type: Number },
    sgst: { type: Number },
    igst: { type: Number },
    createdBy: { type: mongoose.Types.ObjectId, ref: "User" }, // Added field
  },
  {
    timestamps: true,
  }
);

const QuotationModel = mongoose.model("Quotation", QuotationSchema);

module.exports = QuotationModel;
