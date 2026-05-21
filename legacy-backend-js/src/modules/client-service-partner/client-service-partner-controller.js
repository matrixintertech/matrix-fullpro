const { ClientServicePartnerModal } = require("./client-service-partner-modal");
const mongoose = require("mongoose"); // Import mongoose for ObjectId validation

// Create a new user
const createClientServicePartner = async (req, res) => {
  try {
    const { clientId, servicePartnerIds } = req.body;

    // console.log(servicePartnerIds, "servicePartnerIds");

    const alreadyExists = await ClientServicePartnerModal?.distinct(
      "servicePartnerId",
      {
        clientId,
        servicePartnerId: { $in: servicePartnerIds },
      }
    );

    if (alreadyExists?.length === servicePartnerIds?.length) {
      return res.status(500).json({
        message: "Service Partner already assigned",
      });
    } else {
      const newData = await ClientServicePartnerModal.insertMany(
        servicePartnerIds
          ?.filter(
            (servicePartnerId) =>
              !alreadyExists
                ?.map((id) => id?.toString())
                ?.includes(servicePartnerId)
          )
          ?.map((servicePartnerId) => ({
            servicePartnerId,
            clientId,
          }))
      );

      return res.status(201).json({
        message: "Service Partner Mappings created successfully",
        user: newData,
      });
    }
  } catch (error) {
    return res.status(500).json({
      message: "Error creating Service Partner Mappings",
      error: error.message,
    });
  }
};

// Get all users
const getAllClientServicePartners = async (req, res) => {
  try {
    const users = await ClientServicePartnerModal.find()
      .populate(["clientId", "servicePartnerId"])
      .sort({
        createdAt: -1,
      });
    return res.status(200).json(users);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching users", error: error.message });
  }
};
// Get all users
const getAllClientServicePartnersByQuery = async (req, res) => {
  try {
    const users = await ClientServicePartnerModal.find(req?.query)
      .populate(["clientId", "servicePartnerId"])
      .sort({
        createdAt: -1,
      });
    return res.status(200).json(users);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching users", error: error.message });
  }
};

// Get a single user by ID
const getClientServicePartnerById = async (req, res) => {
  try {
    const user = await ClientServicePartnerModal.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ message: "Service Partner Mapping not found" });
    }
    return res.status(200).json(user);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching user", error: error.message });
  }
};

// Update user details
const updateClientServicePartner = async (req, res) => {
  try {
    const { reporting_to, clientId } = req.body;

    // Validate ObjectId for reporting_to only if it's provided
    if (
      reporting_to &&
      reporting_to !== "" &&
      !mongoose.Types.ObjectId.isValid(reporting_to)
    ) {
      return res.status(400).json({ message: "Invalid reporting_to ID" });
    }
    if (clientId && !mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ message: "Invalid clientId" });
    }

    const updatedUser = await ClientServicePartnerModal.findByIdAndUpdate(
      req.params.id,
      { ...req.body, reporting_to: reporting_to || undefined },
      { new: true } // Return the updated user
    );
    if (!updatedUser) {
      return res
        .status(404)
        .json({ message: "Service Partner Mapping not found" });
    }
    return res.status(200).json({
      message: "Service Partner Mapping updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error updating user", error: error.message });
  }
};

// Delete a user
const deleteClientServicePartner = async (req, res) => {
  try {
    const deletedUser = await ClientServicePartnerModal.findByIdAndDelete(
      req.params.id
    );
    if (!deletedUser) {
      return res
        .status(404)
        .json({ message: "Service Partner Mapping not found" });
    }
    return res
      .status(200)
      .json({ message: "Service Partner Mapping deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error deleting user", error: error.message });
  }
};

module.exports = {
  createClientServicePartner,
  getAllClientServicePartners,
  getAllClientServicePartnersByQuery,
  getClientServicePartnerById,
  updateClientServicePartner,
  deleteClientServicePartner,
};
