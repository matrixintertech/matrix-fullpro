const { checkIfNumberEmailUnique } = require("../../utils/helpers");
const {
  ClientServicePartnerModal,
} = require("../client-service-partner/client-service-partner-modal");
const { ClientUserModal } = require("./clientUser-modal");
const mongoose = require("mongoose"); // Import mongoose for ObjectId validation

// Create a new user
const createClientUser = async (req, res) => {
  try {
    const {
      name,
      mobile,
      email,
      user_type,
      reporting_to,
      clientId,
      profileImage,
      designation,
    } = req.body;

    // Validate ObjectId for clientId
    if (clientId && !mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ message: "Invalid clientId" });
    }

    // Validate ObjectId for reporting_to only if it's provided
    if (
      reporting_to &&
      reporting_to !== "" &&
      !mongoose.Types.ObjectId.isValid(reporting_to)
    ) {
      return res.status(400).json({ message: "Invalid reporting_to ID" });
    }

    const is_unique = await checkIfNumberEmailUnique(mobile, email);
    // console.log(is_unique, "is_unique");

    if (!is_unique?.success && is_unique?.error) {
      return res.status(400).json({ message: is_unique?.error });
    }

    const newUser = new ClientUserModal({
      name,
      mobile,
      email,
      user_type,
      designation,
      reporting_to: reporting_to || undefined,
      clientId,
      profileImage,
    });
    await newUser.save();
    return res
      .status(201)
      .json({ message: "User created successfully", user: newUser });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error creating user", error: error.message });
  }
};

// Get all users
const getAllClientUsers = async (req, res) => {
  try {
    const users = await ClientUserModal.find().sort({ createdAt: -1 });
    return res.status(200).json(users);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching users", error: error.message });
  }
};

// Get users by query
const getUsersByQuery = async (req, res) => {
  try {
    let designation_query = {};
    const { designations, ...rest } = req?.body;
    if (designations) {
      designation_query = { designation: { $in: designations } };
    }
    // console.log(designation_query, "designation_query");

    const users = await ClientUserModal.find({
      ...rest,
      ...designation_query,
    })
      .sort({ createdAt: -1 })
      .populate("clientId");
    return res.status(200).json(users);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching users", error: error.message });
  }
};

// Get a single user by ID
const getClientUserById = async (req, res) => {
  try {
    const user = await ClientUserModal.findById(req.params.id).populate([
      "reporting_to",
      "clientId",
    ]);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json(user);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching user", error: error.message });
  }
};
const getClientUserByClientId = async (req, res) => {
  try {
    const { id: clientId } = req.params;

    // Validate ObjectId for clientId
    if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ message: "Invalid clientId" });
    }

    const user = await ClientUserModal.find({ clientId })
      .sort({
        createdAt: -1,
      })
      .populate("clientId");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json(user);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching user", error: error.message });
  }
};
const getClientUserByClientIdWithoutAdmin = async (req, res) => {
  try {
    const { id: clientId } = req.params;

    // Validate ObjectId for clientId
    if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ message: "Invalid clientId" });
    }

    const user = await ClientUserModal.find({
      clientId,
      user_type: { $ne: "admin" },
    })
      .populate(["reporting_to", "clientId"])
      .sort({ createdAt: -1 });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.log(error, "error");

    return res
      .status(500)
      .json({ message: "Error fetching user", error: error.message });
  }
};
const getClientUsersForServicePartner = async (req, res) => {
  try {
    let matchQuery = {};
    if (req?.query?.clientId) {
      matchQuery.clientId = new mongoose.Types.ObjectId(req?.query?.clientId);
    }
    if (req?.query?.servicePartnerId) {
      matchQuery.servicePartnerId = new mongoose.Types.ObjectId(
        req?.query?.servicePartnerId
      );
    }

    const users = await ClientServicePartnerModal.aggregate([
      {
        $match: matchQuery,
      },
      {
        $lookup: {
          from: "clientusers",
          localField: "clientId",
          foreignField: "clientId",
          as: "client_users",
        },
      },
      {
        $unwind: "$client_users",
      },
      {
        $lookup: {
          from: "clients", // Assuming the collection name is "clients"
          localField: "client_users.clientId",
          foreignField: "_id",
          as: "client",
        },
      },
      {
        $lookup: {
          from: "clientusers",
          localField: "client_users.reporting_to",
          foreignField: "_id",
          as: "reporting_to",
        },
      },
      {
        $addFields: {
          client_users: {
            clientId: { $arrayElemAt: ["$client", 0] },
            reporting_to: { $arrayElemAt: ["$reporting_to", 0] },
          },
        },
      },
      {
        $replaceRoot: { newRoot: "$client_users" },
      },
    ]);

    // console.log(users, "usersusers");

    return res.status(200).json(users);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching users", error: error.message });
  }
};
// Update user details
const updateClientUser = async (req, res) => {
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

    const updatedUser = await ClientUserModal.findByIdAndUpdate(
      req.params.id,
      { ...req.body, reporting_to: reporting_to || undefined },
      { new: true } // Return the updated user
    );
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    return res
      .status(200)
      .json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error updating user", error: error.message });
  }
};

// Delete a user
const deleteClientUser = async (req, res) => {
  try {
    const deletedUser = await ClientUserModal.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error deleting user", error: error.message });
  }
};

module.exports = {
  createClientUser,
  getAllClientUsers,
  getUsersByQuery,
  getClientUserById,
  updateClientUser,
  deleteClientUser,
  getClientUserByClientId,
  getClientUserByClientIdWithoutAdmin,
  getClientUsersForServicePartner,
};
