const PurchaseOrderModel = require("./purchase-order-model");

const createPurchaseOrder = async (req, res) => {
  try {
    const po = new PurchaseOrderModel(req.body);
    await po.save();
    res.status(201).json({ message: "Purchase Order created", data: po });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating Purchase Order", error: error.message });
  }
};

// Get all Purchase Orders
const getAllPurchaseOrders = async (req, res) => {
  try {
    const { supplierName, serviceRequestTitle } = req.query;

    // Build aggregation pipeline for filtering by supplier name and service request title
    const pipeline = [
      {
        $lookup: {
          from: "suppliers",
          localField: "supplierId",
          foreignField: "_id",
          as: "supplier",
        },
      },
      {
        $lookup: {
          from: "servicerequests",
          localField: "serviceRequestId",
          foreignField: "_id",
          as: "serviceRequest",
        },
      },
      { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },
      {
        $unwind: { path: "$serviceRequest", preserveNullAndEmptyArrays: true },
      },
    ];

    // Add match stage if filters are provided
    const match = {};
    if (supplierName) {
      match["supplier.name"] = { $regex: supplierName, $options: "i" };
    }
    if (serviceRequestTitle) {
      match["serviceRequest.title"] = {
        $regex: serviceRequestTitle,
        $options: "i",
      };
    }
    if (Object.keys(match).length > 0) {
      pipeline.push({ $match: match });
    }

    // Optionally, remove supplier and serviceRequest arrays from result
    pipeline.push({
      $project: {
        "supplier.password": 0,
        "supplier.__v": 0,
        "serviceRequest.__v": 0,
      },
    });

    const orders = await PurchaseOrderModel.aggregate(pipeline);

    res.status(200).json({ data: orders });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching Purchase Orders",
      error: error.message,
    });
  }
};

const getPurchaseOrderById = async (req, res) => {
  try {
    const order = await PurchaseOrderModel.findById(req.params.id).populate(
      "serviceRequestId createdBy supplierId"
    );
    if (!order)
      return res.status(404).json({ message: "Purchase Order not found" });
    res.status(200).json({ data: order });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching Purchase Order", error: error.message });
  }
};

const updatePurchaseOrder = async (req, res) => {
  try {
    const order = await PurchaseOrderModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!order)
      return res.status(404).json({ message: "Purchase Order not found" });
    res.status(200).json({ message: "Purchase Order updated", data: order });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating Purchase Order", error: error.message });
  }
};

// Delete Purchase Order
const deletePurchaseOrder = async (req, res) => {
  try {
    const order = await PurchaseOrderModel.findByIdAndDelete(req.params.id);
    if (!order)
      return res.status(404).json({ message: "Purchase Order not found" });
    res.status(200).json({ message: "Purchase Order deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting Purchase Order", error: error.message });
  }
};

// Get all Purchase Orders by approvalStatus (Pending)
const getPendingPurchaseOrders = async (req, res) => {
  try {
    const orders = await PurchaseOrderModel.find({
      approvalStatus: "Pending",
    }).populate("serviceRequestId createdBy supplierId");
    res.status(200).json({ data: orders });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching pending Purchase Orders",
      error: error.message,
    });
  }
};

// Get all Purchase Orders by approvalStatus (Approved/Rejected)
const getProcessedPurchaseOrders = async (req, res) => {
  try {
    const orders = await PurchaseOrderModel.find({
      approvalStatus: { $in: ["Approved", "Rejected"] },
    }).populate("serviceRequestId createdBy supplierId");
    res.status(200).json({ data: orders });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching processed Purchase Orders",
      error: error.message,
    });
  }
};

// Approve or Reject a Purchase Order
const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // status should be "Approved" or "Rejected"

    if (!["Approved", "Rejected"].includes(status)) {
      return res
        .status(400)
        .json({ message: "Invalid status. Use 'Approved' or 'Rejected'." });
    }

    const order = await PurchaseOrderModel.findByIdAndUpdate(
      id,
      { approvalStatus: status },
      { new: true }
    ).populate("serviceRequestId createdBy supplierId");

    if (!order) {
      return res.status(404).json({ message: "Purchase Order not found" });
    }

    res.status(200).json({
      message: `Purchase Order ${status.toLowerCase()} successfully.`,
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating Purchase Order status",
      error: error.message,
    });
  }
};

// Get all Purchase Orders by servicePartnerId
const getPurchaseOrdersByServicePartnerId = async (req, res) => {
  try {
    const { servicePartnerId } = req.params;
    const orders = await PurchaseOrderModel.find({ servicePartnerId }).populate(
      "serviceRequestId createdBy supplierId"
    );
    res.status(200).json({ data: orders });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching Purchase Orders by Service Partner",
      error: error.message,
    });
  }
};

module.exports = {
  createPurchaseOrder,
  getAllPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getPendingPurchaseOrders,
  getProcessedPurchaseOrders,
  updatePurchaseOrderStatus,
  getPurchaseOrdersByServicePartnerId,
};
