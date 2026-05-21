const mongoose = require("mongoose");

const PurchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: {
      type: String,
      required: true,
      unique: true,
    },
    serviceRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceRequest",
      required: true,
    },
    servicePartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServicePartner",
      required: false, // set to true if mandatory
    },
    items: [
      {
        desc: { type: String, required: true },
        qty: { type: Number, required: true, min: 0 },
        rate: { type: Number, required: true, min: 0 },
        total: { type: Number, required: true, min: 0 },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    approvalStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

PurchaseOrderSchema.pre("save", function (next) {
  this.totalAmount = (this.items || []).reduce(
    (sum, item) => sum + (item.total || 0),
    0
  );
  next();
});

PurchaseOrderSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.items) {
    const items = update.items;
    // If $set is used
    const arr = Array.isArray(items) ? items : items.$each || [];
    update.totalAmount = arr.reduce((sum, item) => sum + (item.total || 0), 0);
  }
  next();
});

const PurchaseOrderModel = mongoose.model("PurchaseOrder", PurchaseOrderSchema);

module.exports = PurchaseOrderModel;
