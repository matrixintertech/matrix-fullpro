const mongoose = require("mongoose");

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  permissions: { type: Array, of: String, default: [] },
  servicePartnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServicePartner",
    required: true,
  },
});

const RoleModel = mongoose.model("Role", RoleSchema);

module.exports = { RoleModel };
