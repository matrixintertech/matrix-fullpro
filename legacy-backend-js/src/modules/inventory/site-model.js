const mongoose = require("mongoose");

const SiteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
    },
  },
  {
    timestamps: true,
  }
);
const SiteModel = mongoose.model("Site", SiteSchema);
module.exports = { SiteModel };
