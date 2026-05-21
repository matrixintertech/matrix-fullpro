const mongoose = require("mongoose");

const ServicePartnerSchema = new mongoose.Schema(
  {
    company_name: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mobile: { type: String, required: true, unique: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    address: { type: String },
    status: {
      type: String,
      enum: ["Approved", "Rejected", "Pending"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  }
);

const ServicePartnerModel = mongoose.model(
  "ServicePartner",
  ServicePartnerSchema
);

module.exports = { ServicePartnerModel };
