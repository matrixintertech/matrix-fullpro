const mongoose = require("mongoose");

const ClientUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mobile: { type: String, required: true, unique: true },
    user_type: { type: String, enum: ["admin", "clientUser"], required: true },
    designation: {
      type: String,
      required: function () {
        return this.user_type === "clientUser";
      },
    },
    profileImage: {
      type: String,
      required: false,
    },
    reporting_to: {
      type: mongoose.Types.ObjectId,
      ref: "ClientUser",
    },
    clientId: { type: mongoose.Types.ObjectId, ref: "Client" },
  },
  {
    timestamps: true,
  }
);

const ClientUserModal = mongoose.model("ClientUser", ClientUserSchema);
module.exports = { ClientUserModal };
