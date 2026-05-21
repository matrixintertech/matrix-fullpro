const mongoose = require("mongoose");
const { checkIfNumberEmailUnique } = require("../../utils/helpers");
const { sendSuccessResponse } = require("../../utils/response");
const { SupplierModal } = require("./supplier-modal");

const createSupplier = async (req, res) => {
  try {
    const supplierData = { ...req.body };

    // Normalize field names (handle snake_case to camelCase conversion)
    if (supplierData.legal_status) {
      supplierData.legalStatus = supplierData.legal_status;
      delete supplierData.legal_status;
    }

    if (supplierData?.mobile || supplierData?.email) {
      const is_unique = await checkIfNumberEmailUnique(
        supplierData?.mobile,
        supplierData?.email
      );

      if (!is_unique?.success && is_unique?.error) {
        return res.status(400).json({ message: is_unique?.error });
      }
    }
    const newSupplier = await SupplierModal.create(supplierData);
    sendSuccessResponse(res, {
      message: "Supplier created successfully",
      supplier: newSupplier,
    });
  } catch (error) {
    console.log(error, "errorerror");

    return res
      .status(500)
      .json({ message: "Error Creating Supplier", error: error.message });
  }
};

const getAllSuppliers = async (req, res) => {
  try {
    const query = req?.query;
    const suppliers = await SupplierModal.find(query)
      .populate("refferredBy", "name email mobile")
      .populate("approvedBy", "name email mobile")
      .sort({ createdAt: -1 });
    sendSuccessResponse(res, {
      data: suppliers,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching suppliers", error: error.message });
  }
};

const getSupplierById = async (req, res) => {
  try {
    const supplier = await SupplierModal.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    return res.status(200).json(supplier);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching supplier", error: error.message });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate ObjectId
    if (!id || id === "undefined" || id === "null") {
      return res.status(400).json({
        message: "Invalid or missing supplier ID parameter",
      });
    }

    // Check if supplier exists
    const existingSupplier = await SupplierModal.findById(id);
    if (!existingSupplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    // Validate unique fields (mobile, email, supplier_code) if they are being updated
    if (updateData.mobile || updateData.email || updateData.supplier_code) {
      const is_unique = await checkIfNumberEmailUnique(
        updateData.mobile,
        updateData.email,
        id,
        updateData.supplier_code
      );

      if (!is_unique?.success && is_unique?.error) {
        return res.status(400).json({ message: is_unique?.error });
      }
    }

    // Normalize field names (handle snake_case to camelCase conversion)
    if (updateData.legal_status) {
      updateData.legalStatus = updateData.legal_status;
      delete updateData.legal_status;
    }

    // Validate enum fields
    if (
      updateData.type &&
      !["Supplier", "Contractor"].includes(updateData.type)
    ) {
      return res.status(400).json({
        message: "Invalid type. Must be either 'Supplier' or 'Contractor'",
      });
    }

    if (
      updateData.legal_status &&
      ![
        "sole_proprietorship",
        "private_limited",
        "public_limited",
        "partnership",
        "llp",
      ].includes(updateData.legal_status)
    ) {
      return res.status(400).json({
        message:
          "Invalid legal status. Must be one of: sole_proprietorship, private_limited, public_limited, partnership, llp",
      });
    }

    // Validate dealingIn array if provided
    if (updateData.dealingIn && Array.isArray(updateData.dealingIn)) {
      const validDealingIn = [
        "Plumbing",
        "Electrician",
        "Carpenter",
        "dealingIn",
      ];
      const invalidItems = updateData.dealingIn.filter(
        (item) => !validDealingIn.includes(item)
      );
      if (invalidItems.length > 0) {
        return res.status(400).json({
          message: `Invalid dealingIn values: ${invalidItems.join(
            ", "
          )}. Must be one of: ${validDealingIn.join(", ")}`,
        });
      }
    }

    // Validate documents array structure if provided
    if (updateData.documents && Array.isArray(updateData.documents)) {
      const invalidDocs = updateData.documents.filter(
        (doc) =>
          !doc.url ||
          !doc.title ||
          typeof doc.url !== "string" ||
          typeof doc.title !== "string"
      );
      if (invalidDocs.length > 0) {
        return res.status(400).json({
          message:
            "Invalid documents format. Each document must have 'url' and 'title' as strings",
        });
      }
    }

    // Validate boolean fields
    if (
      updateData.isVendor !== undefined &&
      typeof updateData.isVendor !== "boolean"
    ) {
      return res.status(400).json({
        message: "isVendor must be a boolean value",
      });
    }

    if (
      updateData.isVerified !== undefined &&
      typeof updateData.isVerified !== "boolean"
    ) {
      return res.status(400).json({
        message: "isVerified must be a boolean value",
      });
    }

    // Validate servicePartnerId if provided
    if (
      updateData.servicePartnerId &&
      !mongoose.Types.ObjectId.isValid(updateData.servicePartnerId)
    ) {
      return res.status(400).json({
        message: "Invalid servicePartnerId format",
      });
    }
    // Update the supplier
    const updatedSupplier = await SupplierModal.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedSupplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    sendSuccessResponse(res, {
      message: "Supplier updated successfully",
      supplier: updatedSupplier,
    });
  } catch (error) {
    console.log(error, "Error updating supplier");

    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return res.status(400).json({
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        message: `Duplicate value error for field: ${duplicateField}. Please use a unique value.`,
      });
    }

    return res.status(500).json({
      message: "Error updating supplier",
      error: error.message,
    });
  }
};

const deleteSupplier = async (req, res) => {
  try {
    const deletedSupplier = await SupplierModal.findByIdAndDelete(
      req.params.id
    );
    if (!deletedSupplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    return res.status(200).json({ message: "Supplier deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error deleting Supplier", error: error.message });
  }
};

module.exports = {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
};
