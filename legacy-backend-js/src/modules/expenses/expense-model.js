const mongoose = require("mongoose");

const Status = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
};
const ExpenseSchema = new mongoose.Schema(
  {
    servicePartnerId: {
      type: mongoose.Types.ObjectId,
      ref: "ServicePartner",
    },
    serviceRequestId: {
      type: mongoose.Types.ObjectId,
      ref: "ServiceRequest",
      required: true,
    },
    user_id: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
    vendorId: {
      type: mongoose.Types.ObjectId,
      ref: "Supplier",
    },
    bill_date: {
      type: Date,
    },
    bill_number: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    approved_amount: {
      type: Number,
    },
    desc: {
      type: String,
      required: true,
    },
    remark: {
      type: String,
    },
    file: {
      type: mongoose.Schema.Types.Mixed,
    },
    files: {
      type: [String],
      default: [],
    },
    expenseStatus: {
      type: String,
      required: true,
      default: Status.REQUESTED,
    },
    action_taken_by: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
    expenseId: {
      type: String,
      unique: true,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to normalize file data for backward compatibility
ExpenseSchema.pre("save", function (next) {
  // If single file exists and files array is empty, add it to files array
  if (this.file && (!this.files || this.files.length === 0)) {
    this.files = [this.file];
  }
  // If files array exists but file field is empty, keep files as is
  // This ensures backward compatibility while supporting multiple files
  next();
});

// Virtual method to get all files (combines file and files for backward compatibility)
ExpenseSchema.virtual("allFiles").get(function () {
  const fileList = [];
  if (this.file) {
    fileList.push(this.file);
  }
  if (this.files && this.files.length > 0) {
    this.files.forEach((f) => {
      if (f && !fileList.includes(f)) {
        fileList.push(f);
      }
    });
  }
  return fileList;
});

// Ensure virtuals are included in JSON output
ExpenseSchema.set("toJSON", { virtuals: true });
ExpenseSchema.set("toObject", { virtuals: true });

const ExpenseModel = mongoose.model("Expenses", ExpenseSchema);

module.exports = { ExpenseModel, Status };
