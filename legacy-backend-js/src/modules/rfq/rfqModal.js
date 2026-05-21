const mongoose = require("mongoose");

const RFQSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String },
    type: { type: String },
    expectedDeadline: { type: String, required: true },
    // vendorExpectedDeadline: { type: Date, required: true },
    items: [
      {
        type: mongoose.Schema.Types.Mixed,
      },
    ],

    status: {
      type: String,
      enum: ["DRAFT", "SENT", "RESPONDED", "APPROVED", "ACCEPTED", "REJECTED"],
      default: "DRAFT",
    },

    assignedVendors: [
      {
        vendorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Supplier",
          required: true,
        },
        assignedDate: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: [
            "PENDING",
            "VIEWED",
            "RESPONDED",
            "APPROVED",
            "ACCEPTED",
            "REJECTED",
          ],
          default: "PENDING",
        },
        quotation: {
          amount: Number,
          details: String,
          items: [
            {
              itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
              itemName: String,
              unit: String,
              quantity: String,
              description: String,

              price: String,
              hsnCode: String,
              gstPercentage: {
                type: Number,
                min: 0,
                max: 100,
              },
            },
          ],
          submittedAt: Date,
          vendorExpectedDeadline: Date,
        },
      },
    ],
    paymentTerms: String,
    freightExtra: {
      isApplicable: Boolean,
      amount: Number,
    },

    createdByservicePartnerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    servicePartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServicePartner",
      required: true,
    },
    serviceRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceRequest",
      required: true,
    },
    rfqNo: {
      type: String,
      unique: true,
      required: true,
    },
    poId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Po",
    },
  },
  {
    timestamps: true,
  }
);

const RFQModel = mongoose.model("RFQ", RFQSchema);

module.exports = { RFQModel };
