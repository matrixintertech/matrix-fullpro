const mongoose = require("mongoose");

const VendorSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    mobile: { type: String, required: true, unique: true },
    isVendor: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    profileImage: {
      type: String,
      required: false,
    },

    country: {
      type: String,
      // required: false,
    },
    companyName: {
      type: String,
    },
    address: {
      type: String,
    },
    type: {
      type: String,
    },
    legalStatus: {
      type: String,
      enum: [
        "sole_proprietorship",
        "private_limited",
        "public_limited",
        "partnership",
        "llp",
      ],
      // default: "active",
    },
    contactPerson: {
      type: String,
    },
    dealingIn: [
      {
        type: String,
        enum: ["Plumbing", "Electrician", "Carpenter", "dealingIn"],
      },
    ],
    documentsType: {
      type: String,
      enum: ["aadhaar", "pan", "gst", "license", "registration_certificate"],
    },
    documentLink: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

const VendorModal = mongoose.model("Vendor", VendorSchema);
module.exports = { VendorModal };
