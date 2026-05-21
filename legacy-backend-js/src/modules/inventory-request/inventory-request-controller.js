const {
  sendSuccessResponse,
  sendFailedResponse,
} = require("../../utils/response");
const { InventoryRequestModal } = require("./inventory-request-modal");

const createInventoryRequest = async (req, res) => {
  console.log("Creating InventoryRequest with body:", req.body);
  try {
    const newInventoryRequest = await InventoryRequestModal.create(req?.body);
    sendSuccessResponse(res, {
      message: "InventoryRequest created successfully",
      inventoryRequest: newInventoryRequest,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error Creating InventoryRequest",
      error: error.message,
    });
  }
};

const getAllInventoryRequests = async (req, res) => {
  try {
    const query = req?.query;
    const inventoryRequests = await InventoryRequestModal.find(query)
      .sort({
        createdAt: -1,
      })
      .populate([
        "items.item",
        "servicePartnerId",
        "serviceRequestId",
        "requestedBy",
        {
          path: "serviceRequestId",
          populate: {
            path: "branch_id",
            model: "Branch",
          },
        },
      ]);

    sendSuccessResponse(res, {
      data: inventoryRequests,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching inventoryRequests",
      error: error.message,
    });
  }
};

const getInventoryRequestById = async (req, res) => {
  try {
    const inventoryRequest = await InventoryRequestModal.findById(
      req.params.id
    ).populate("items.item");
    if (!inventoryRequest) {
      return res.status(404).json({ message: "InventoryRequest not found" });
    }
    return res.status(200).json(inventoryRequest);
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching inventoryRequest",
      error: error.message,
    });
  }
};

const updateInventoryRequest = async (req, res) => {
  try {
    const updatedInventoryRequest =
      await InventoryRequestModal.findByIdAndUpdate(
        req.params.id,
        { ...req.body },
        { new: true }
      );
    if (!updatedInventoryRequest) {
      return res.status(404).json({ message: "InventoryRequest not found" });
    }
    return res.status(200).json({
      message: "InventoryRequest updated successfully",
      inventoryRequest: updatedInventoryRequest,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating inventoryRequest",
      error: error.message,
    });
  }
};

const deleteInventoryRequest = async (req, res) => {
  try {
    const deletedInventoryRequest =
      await InventoryRequestModal.findByIdAndDelete(req.params.id);
    if (!deletedInventoryRequest) {
      return res.status(404).json({ message: "InventoryRequest not found" });
    }
    return res
      .status(200)
      .json({ message: "InventoryRequest deleted successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Error deleting InventoryRequest",
      error: error.message,
    });
  }
};

module.exports = {
  createInventoryRequest,
  getAllInventoryRequests,
  getInventoryRequestById,
  updateInventoryRequest,
  deleteInventoryRequest,
};
