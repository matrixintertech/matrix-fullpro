const mongoose = require("mongoose");

const SupplierSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Supplier", "Contractor"] },
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, trim: true },
    mobile: { type: Number, unique: true, trim: true },
    supplier_code: { type: String, unique: true },
    gst_number: { type: String },
    contact_name: { type: String },
    ifsc_code: { type: String },
    state: { type: String },
    city: { type: String },
    address: { type: String },
    documents: [
      {
        url: String,
        title: String,
      },
    ],
    servicePartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServicePartner",
    },

    isVendor: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
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
    profileImage: {
      type: String,
      required: false,
    },

    companyName: {
      type: String,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    refferredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
    },
    bank_name: {
      type: String,
    },
    account_number: {
      type: String,
    },

    dealingIn: [
      {
        type: String,
        enum: ["Plumbing", "Electrician", "Carpenter", "dealingIn"],
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Function to generate a unique supplier_code
async function generateUniqueSupplierCode() {
  const getRandomLetter = () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
  const getRandomNumber = () => Math.floor(1000 + Math.random() * 9000); // 1000-9999

  let supplier_code;
  let exists = true;

  while (exists) {
    supplier_code = `${getRandomLetter()}${getRandomNumber()}`;
    exists = await mongoose.models.Supplier.exists({ supplier_code });
  }

  return supplier_code;
}

// Pre-save middleware to assign a unique supplier_code
SupplierSchema.pre("save", async function (next) {
  if (!this.supplier_code) {
    this.supplier_code = await generateUniqueSupplierCode();
  }
  next();
});

const SupplierModal = mongoose.model("Supplier", SupplierSchema);
module.exports = { SupplierModal };

// // Run this as a one-time script or add to a controller/admin route
// async function verifyAllSuppliers() {
//   await SupplierModal.updateMany({}, { isVerified: true });
//   console.log("All suppliers set to verified.");
// }

// verifyAllSuppliers();
