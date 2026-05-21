const mongoose = require("mongoose");

// Define the Item schema
const ItemSchema = new mongoose.Schema(
  {
    servicePartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServicePartner",
      required: true,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    additional_description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      // required: true,
      trim: true,
    },
    hsnCode: {
      type: String,
      // required: true,
      trim: true,
    },
    gstPercentage: {
      type: Number,
      // required: true,
      min: 0,
      max: 100,
    },
    unit: {
      type: String,
      // required: true,
      trim: true,
    },
    remarks: {
      type: String,
      // required: true,
      trim: true,
    },
    inventoryType: {
      type: String,
      enum: ["Service", "Product"],
    },
    qty: {
      type: Number,
      // required: true,
      min: 0,
    },

    usedqty: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Create the Item model
const ItemModel = mongoose.model("Item", ItemSchema);

module.exports = ItemModel;
