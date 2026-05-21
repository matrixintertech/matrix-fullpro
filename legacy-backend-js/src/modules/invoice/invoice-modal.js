const mongoose = require("mongoose");

const InvoiceSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
    },
    poId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Po",
    },
    rfqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RFQ",
    },
    usedQuantity: {
      type: Number,
    },
    consumedPrice: {
      type: Number,
    },
    actualQuantity: {
      type: Number,
    },
    actulPrice: {
      type: Number,
    },
    totalAmount: {
      type: Number,
    },
    invoiceCount: {
      type: Number,
      default: 0,
    },
    isInvoiceGenerated: {
      type: Boolean,
      default: false,
    },
    invoiceData: [
      {
        date: {
          type: Date,
        },
        isApproved: {
          enum: ["Pending", "Approved", "Rejected"],
          type: String,
          default: "Pending",
        },
        approvalDate: {
          type: Date,
        },
        isPaid: {
          enum: ["Pending", "Paid"],
          type: String,
          default: "Pending",
        },
        items: [
          {
            itemId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Item",
            },
            hsnCode: {
              type: String,
            },
            quantity: {
              type: Number,
            },
            price: {
              type: Number,
            },
            usedQuantity: {
              type: Number,
            },
            consumedPrice: {
              type: Number,
            },

            // remarks: {
            //   type: String,
            // },
          },
        ],
        attachment: {
          type: String, // URL or file path
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const InvoiceModel = mongoose.model("Invoice", InvoiceSchema);

module.exports = { InvoiceModel };
