const { SupplierModal } = require("../supplier/supplier-modal");
const { sendFailedResponse } = require("../../utils/response");
const { checkIfNumberEmailUnique } = require("../../utils/helpers");

const getVendorsBasedOnType = async (req, res) => {
  try {
    const { type, servicePartnerId } = req?.body;
    const vendors = await SupplierModal.find({
      type: type,
      servicePartnerId: servicePartnerId,
    }).sort({ createdAt: -1 });

    return res.status(200).json(vendors);
  } catch (error) {
    sendFailedResponse(res, {}, error);
  }
};
const getVendorsBasedOnDealingIn = async (req, res) => {
  try {
    const { dealingIn, servicePartnerId } = req?.body;
    const vendors = await SupplierModal.find({
      dealingIn: dealingIn,
      servicePartnerId: servicePartnerId,
    }).sort({ createdAt: -1 });

    return res.status(200).json(vendors);
  } catch (error) {
    sendFailedResponse(res, {}, error);
  }
};

const getVendorAndClientVendorById = async (req, res) => {
  const { id } = req.params;

  try {
    const vendor = await SupplierModal.findById(id)
      .populate("servicePartnerId")
      .lean()
      .sort({ createdAt: -1 });
    if (vendor) {
      return res.status(200).json({
        Vendor: vendor,
        VendorFrom: "Vendor",
      });
    } else {
      const ClientVendor = await ClientSupplierModal.findById(id)
        .populate(["clientId", "reporting_to"])
        .sort({ createdAt: -1 });
      // console.log(ClientVendor, "populated client Id");
      if (!ClientVendor) {
        return res.status(500).json({ message: "No Vendor Available", error });
      }
      return res.status(200).json({
        Vendor: ClientVendor,
        VendorFrom: "ClientVendor",
      });
    }
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

// Create a new Vendor
const createVendor = async (req, res) => {
  try {
    const {
      email,
      mobile,
      isVendor,
      profileImage,
      servicePartnerId,
      name, // companyName mapped to name
      address,
      type,
      contact_name, // contactPerson mapped to contact_name
      dealingIn,
      documents, // should be array of { url, title }
      gst_number,
      ifsc_code,
      state,
      city,
    } = req.body;

    const is_unique = await checkIfNumberEmailUnique(mobile, email);

    if (!is_unique?.success && is_unique?.error) {
      return res.status(400).json({ message: is_unique?.error });
    }

    const newVendor = new SupplierModal({
      email,
      mobile,
      isVendor,
      profileImage,
      servicePartnerId,
      name,
      address,
      type,
      contact_name,
      dealingIn,
      documents,
      gst_number,
      ifsc_code,
      state,
      city,
    });

    await newVendor.save();

    return res
      .status(201)
      .json({ message: "Vendor created successfully", Vendor: newVendor });
  } catch (error) {
    sendFailedResponse(res, {}, error);
  }
};

// Get all Vendors
const getAllVendors = async (req, res) => {
  try {
    const Vendors = await SupplierModal.find(req?.query);
    return res.status(200).json(Vendors);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching Vendors", error: error.message });
  }
};

const getVendorWithServicePartnerIdWithoutAdmin = async (req, res) => {
  try {
    const { id: servicePartnerId } = req.params;
    const Vendor = await SupplierModal.find({
      servicePartnerId,
      type: { $ne: "admin" }, // Using type instead of VendorType
    })
      .populate("servicePartnerId")
      .sort({ createdAt: -1 });
    if (!Vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }
    return res.status(200).json(Vendor);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching Vendor", error: error.message });
  }
};

// Get a single Vendor by ID
const getVendorById = async (req, res) => {
  try {
    const Vendor = await SupplierModal.findById(req.params.id);
    if (!Vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    return res.status(200).json({ Vendor });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching Vendor", error: error.message });
  }
};

// Update Vendor details
const updateVendor = async (req, res) => {
  try {
    if (req?.body?.mobile || req?.body?.email) {
      const is_unique = await checkIfNumberEmailUnique(
        req?.body?.mobile,
        req?.body?.email,
        req?.params?.id
      );

      if (!is_unique?.success && is_unique?.error) {
        return res.status(400).json({ message: is_unique?.error });
      }
    }

    const updatedVendor = await SupplierModal.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    );
    if (!updatedVendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }
    return res
      .status(200)
      .json({ message: "Vendor updated successfully", Vendor: updatedVendor });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error updating Vendor", error: error.message });
  }
};

// Delete a Vendor
const deleteVendor = async (req, res) => {
  try {
    const deletedVendor = await SupplierModal.findByIdAndDelete(req.params.id);
    if (!deletedVendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }
    return res.status(200).json({ message: "Vendor deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error deleting Vendor", error: error.message });
  }
};

const getVendorsExcludingTypes = async (req, res) => {
  try {
    const { servicePartnerId, excludedTypes = [] } = req?.body;

    const query = {
      servicePartnerId: servicePartnerId,
    };

    if (excludedTypes.length > 0) {
      query.type = { $not: { $in: excludedTypes } };
    }

    const Vendors = await SupplierModal.find(query)
      .populate("servicePartnerId")
      .sort({ createdAt: -1 });

    return res.status(200).json(Vendors);
  } catch (error) {
    sendFailedResponse(res, {}, error);
  }
};

const getVendorsByLegalStatus = async (req, res) => {
  try {
    const { legalStatus, servicePartnerId } = req?.body;
    const vendors = await SupplierModal.find({
      legalStatus: legalStatus,
      servicePartnerId: servicePartnerId,
    })
      .populate("servicePartnerId")
      .sort({ createdAt: -1 });

    return res.status(200).json(vendors);
  } catch (error) {
    sendFailedResponse(res, {}, error);
  }
};

module.exports = {
  createVendor,
  getAllVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  getVendorAndClientVendorById,
  getVendorWithServicePartnerIdWithoutAdmin,
  getVendorsBasedOnDealingIn,
  getVendorsBasedOnType,
  getVendorsExcludingTypes,
  getVendorsByLegalStatus,
};
