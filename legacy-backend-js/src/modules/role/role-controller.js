const {
  sendSuccessResponse,
  sendFailedResponse,
} = require("../../utils/response");
const { RoleModel } = require("./role-modal");

const createRole = async (req, res) => {
  try {
    const newRole = await RoleModel.create(req?.body);
    sendSuccessResponse(res, {
      message: "Role created successfully",
      role: newRole,
    });
  } catch (error) {
    sendFailedResponse(
      res,
      {
        message: "Error creating role",
      },
      error
    );
  }
};

const getAllRoles = async (req, res) => {
  try {
    const roles = await RoleModel.find(req?.query);
    sendSuccessResponse(res, {
      data: roles,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching roles" });
  }
};

const getRoleById = async (req, res) => {
  try {
    const role = await RoleModel.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }
    return res.status(200).json(role);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching role" });
  }
};

const updateRole = async (req, res) => {
  try {
    const updatedRole = await RoleModel.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    );
    if (!updatedRole) {
      return res.status(404).json({ message: "Role not found" });
    }
    return res
      .status(200)
      .json({ message: "Role updated successfully", role: updatedRole });
  } catch (error) {
    console.log(error, "error");

    return res.status(500).json({ message: "Error updating role" });
  }
};

const deleteRole = async (req, res) => {
  try {
    const deletedRole = await RoleModel.findByIdAndDelete(req.params.id);
    if (!deletedRole) {
      return res.status(404).json({ message: "Role not found" });
    }
    return res.status(200).json({ message: "Role deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting Role" });
  }
};

module.exports = {
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  deleteRole,
};
