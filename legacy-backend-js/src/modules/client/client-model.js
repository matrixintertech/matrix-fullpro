const mongoose = require("mongoose");

const ClientSchema = new mongoose.Schema(
  {
    client_name: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true },
    client_address: { type: String },
    email: { type: String, required: true, unique: true },
    mobile: { type: String, required: true, unique: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

const ClientModel = mongoose.model("Client", ClientSchema);
module.exports = { ClientModel };
