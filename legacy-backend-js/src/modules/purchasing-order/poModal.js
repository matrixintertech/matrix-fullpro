const mongoose = require("mongoose");

const PoSchema = new mongoose.Schema(
  {
    vednorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
    },
    poNumber: {
      type: String,
      required: true,
      unique: true,
    },
    rfqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RFQ",
    },
    serviceRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceRequest",
    },
    billToAddress: {
      type: String,
    },
    billToGST: {
      type: String,
    },
    shipToAddress: {
      type: String,
    },
    shipToGST: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const PoModel = mongoose.model("Po", PoSchema);

module.exports = { PoModel };
