const mongoose = require("mongoose");

// Define the Inventory schema
const InventorySchema = new mongoose.Schema(
  {
    inventory_request_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryRequest",
    },
    servicePartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServicePartner",
      required: true,
    },
    record_type: {
      type: String,
      enum: ["inventory_in", "inventory_out"],
    },
    inventory_type: {
      type: String,
      enum: ["Purchase", "Return", "Issued"],
    },
    service_request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceRequest",
    },
    received_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    is_godown: {
      type: Boolean,
    },
    bill_no: String,
    bill_date: Date,
    bill_attachment: String,
    person_name: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    supplier_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
    },
    inventory_out_date: { type: Date },

    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
    },
    siteName: {
      type: String,
    },
    outerRemarks: String,

    items: [
      {
        inventory_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Item",
          required: true,
        },
        qty_in: {
          type: Number,
          required: true,
          min: 0,
        },
        qty_out: {
          type: Number,
          required: true,
          min: 0,
        },
        rate: {
          type: Number,
          required: true,
          min: 0,
        },
        remarks: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Create the Inventory model
const InventoryModel = mongoose.model("Inventory", InventorySchema);

module.exports = InventoryModel;
