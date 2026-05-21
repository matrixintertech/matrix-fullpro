const mongoose = require("mongoose");

// Define the AssignService schema
const AssignServiceSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Types.ObjectId,
      ref: "ServiceRequest",
      required: true,
    },
    inventories: [
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
        },
        completionStatus: {
          type: Boolean,
          default: false,
        },
        completionDate: {
          type: Date,
          default: new Date(),
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Create the AssignService model
const AssignServiceModel = mongoose.model("AssignService", AssignServiceSchema);

module.exports = AssignServiceModel;
