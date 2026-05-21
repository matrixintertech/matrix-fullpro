const mongoose = require("mongoose");

const ClientServicePartnerSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Types.ObjectId,
      ref: "Client",
    },
    servicePartnerId: { type: mongoose.Types.ObjectId, ref: "ServicePartner" },
  },
  {
    timestamps: true,
  }
);

const ClientServicePartnerModal = mongoose.model(
  "ClientServicePartner",
  ClientServicePartnerSchema
);
module.exports = { ClientServicePartnerModal };
