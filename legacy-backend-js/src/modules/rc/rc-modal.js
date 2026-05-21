const mongoose = require("mongoose");

const RcSchema = new mongoose.Schema(
  {
    rc_number: { type: String, required: true, unique: true },
    inventory_id: {
      type: mongoose.Types.ObjectId,
      ref: "Item",
    },
    finished_goods: { type: String },
    rate: { type: Number, required: true },
    gstPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    unit: { type: String, required: true },
    clientId: { type: mongoose.Types.ObjectId, ref: "Client" },
    servicePartnerId: {
      type: mongoose.Types.ObjectId,
      ref: "ServicePartner",
    },
  },
  {
    timestamps: true,
  }
);

const RcModal = mongoose.model("Rc", RcSchema);
module.exports = { RcModal };
