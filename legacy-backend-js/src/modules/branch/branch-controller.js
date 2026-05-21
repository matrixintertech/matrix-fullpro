const {
  sendSuccessResponse,
  sendFailedResponse,
} = require("../../utils/response");
const { BranchModal } = require("./branch-modal");

const createBranch = async (req, res) => {
  try {
    const newBranch = await BranchModal.create(req?.body);
    sendSuccessResponse(res, {
      message: "Branch created successfully",
      branch: newBranch,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error Creating Branch", error: error.message });
  }
};

const getAllBranches = async (req, res) => {
  try {
    const query = req?.query;
    const branches = await BranchModal.find(query).sort({ createdAt: -1 });
    sendSuccessResponse(res, {
      data: branches,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching branches", error: error.message });
  }
};

const getBranchById = async (req, res) => {
  try {
    const branch = await BranchModal.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ message: "Branch not found" });
    }
    return res.status(200).json(branch);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching branch", error: error.message });
  }
};

const updateBranch = async (req, res) => {
  try {
    const updatedBranch = await BranchModal.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    );
    if (!updatedBranch) {
      return res.status(404).json({ message: "Branch not found" });
    }
    return res.status(200).json({
      message: "Branch updated successfully",
      branch: updatedBranch,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error updating branch", error: error.message });
  }
};

const deleteBranch = async (req, res) => {
  try {
    const deletedBranch = await BranchModal.findByIdAndDelete(req.params.id);
    if (!deletedBranch) {
      return res.status(404).json({ message: "Branch not found" });
    }
    return res.status(200).json({ message: "Branch deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error deleting Branch", error: error.message });
  }
};

module.exports = {
  createBranch,
  getAllBranches,
  getBranchById,
  updateBranch,
  deleteBranch,
};
