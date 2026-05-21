const { UserModal } = require("./user-modal");
const { ClientUserModal } = require("../client-user/clientUser-modal");
const { SupplierModal } = require("../supplier/supplier-modal");
const { sendFailedResponse } = require("../../utils/response");
const { checkIfNumberEmailUnique } = require("../../utils/helpers");

const getUsersBasedOnRole = async (req, res) => {
  try {
    const { role, servicePartnerId } = req?.body;
    const users = await UserModal.aggregate([
      {
        $addFields: {
          servicePartnerId: {
            $toString: "$servicePartnerId",
          },
        },
      },
      {
        $lookup: {
          from: "roles",
          localField: "role",
          foreignField: "_id",
          as: "roleData",
        },
      },

      {
        $match: {
          "roleData.name": { $regex: new RegExp("^" + role + "$", "i") },
          servicePartnerId: servicePartnerId?.toString(),
        },
      },

      { $unwind: "$roleData" },
    ]);

    return res.status(200).json(users);
  } catch (error) {
    sendFailedResponse(res, {}, error);
    // return res.status(500).json({ message: "Server error", error });
  }
};
const getUsersBasedOnPermissions = async (req, res) => {
  try {
    const { permissions, servicePartnerId } = req?.body;
    const users = await UserModal.aggregate([
      {
        $addFields: {
          servicePartnerId: {
            $toString: "$servicePartnerId",
          },
        },
      },
      {
        $lookup: {
          from: "roles",
          localField: "role",
          foreignField: "_id",
          as: "roleData",
        },
      },

      {
        $match: {
          "roleData.permissions": { $all: permissions },
          servicePartnerId: servicePartnerId?.toString(),
        },
      },

      { $unwind: "$roleData" },
    ]);

    return res.status(200).json(users);
  } catch (error) {
    sendFailedResponse(res, {}, error);
    // return res.status(500).json({ message: "Server error", error });
  }
};

const getUserAndClientUserById = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await UserModal.findById(id)
      .populate(["role", "servicePartnerId"])
      .lean()
      .sort({ createdAt: -1 });
    if (user) {
      return res.status(200).json({
        user: user,
        userFrom: "User",
      });
    } else {
      const ClientUser = await ClientUserModal.findById(id)
        .populate(["clientId", "reporting_to"])
        .sort({ createdAt: -1 });
      if (ClientUser) {
        return res.status(200).json({
          user: ClientUser,
          userFrom: "ClientUser",
        });
      } else {
        const Vendor = await SupplierModal.findById(id)
          .lean()
          .sort({ createdAt: -1 });
        if (!Vendor) {
          return res.status(500).json({ message: "No User Available", error });
        }
        return res.status(200).json({
          user: Vendor,
          userFrom: "Vendor",
        });
      }
    }
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

// Create a new user
const createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      mobile,
      role,
      profileImage,
      userType,
      servicePartnerId,
    } = req.body;
    const is_unique = await checkIfNumberEmailUnique(mobile, email);

    if (!is_unique?.success && is_unique?.error) {
      return res.status(400).json({ message: is_unique?.error });
    }
    const newUser = new UserModal({
      name,
      email,
      mobile,
      role,
      profileImage,
      userType,
      servicePartnerId,
    });
    await newUser.save();
    return res
      .status(201)
      .json({ message: "User created successfully", user: newUser });
  } catch (error) {
    sendFailedResponse(res, {}, error);
    // return res
    //   .status(500)
    //   .json({ message: "Error creating user", error: error.message });
  }
};

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await UserModal.find(req?.query).populate("role", "name");
    return res.status(200).json(users);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching users", error: error.message });
  }
};

const getUserWithServicePartnerIdWithoutAdmin = async (req, res) => {
  try {
    const { id: servicePartnerId } = req.params;
    const user = await UserModal.find({
      servicePartnerId,
      userType: { $ne: "admin" },
    })
      .populate("role")
      .sort({ createdAt: -1 });
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

// Get a single user by ID
const getUserById = async (req, res) => {
  try {
    const user = await UserModal.findById(req.params.id).populate("role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching user", error: error.message });
  }
};

// Update user details
const updateUser = async (req, res) => {
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

    const updatedUser = await UserModal.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
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
const deleteUser = async (req, res) => {
  try {
    const deletedUser = await UserModal.findByIdAndDelete(req.params.id);
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

const getUsersExcludingRoles = async (req, res) => {
  try {
    const { servicePartnerId } = req?.body;
    const excludedRoles = [""];

    const users = await UserModal.aggregate([
      {
        $addFields: {
          servicePartnerId: {
            $toString: "$servicePartnerId",
          },
        },
      },
      {
        $lookup: {
          from: "roles",
          localField: "role",
          foreignField: "_id",
          as: "roleData",
        },
      },
      {
        $match: {
          servicePartnerId: servicePartnerId?.toString(),
          "roleData.name": {
            $not: {
              $in: excludedRoles.map(
                (role) => new RegExp("^" + role + "$", "i")
              ),
            },
          },
        },
      },
      { $unwind: "$roleData" },
    ]);
    // console.log(users);
    return res.status(200).json(users);
  } catch (error) {
    sendFailedResponse(res, {}, error);
  }
};

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserAndClientUserById,
  getUserWithServicePartnerIdWithoutAdmin,
  getUsersBasedOnPermissions,
  getUsersBasedOnRole,
  getUsersExcludingRoles,
};
