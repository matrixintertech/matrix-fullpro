const QuotationModel = require("./quotation-model");
const {
  ServiceRequestModal,
} = require("../serviceRequests/service-request-model");
const AssignServiceModel = require("../assign-serivce/assign-service-model");
const { generateRequestNumber } = require("../../utils/helpers");
const ItemModel = require("../item/item-model");
const { RcModal } = require("../rc/rc-modal");

const createQuotation = async (req, res) => {
  try {
    const {
      serviceRequestId,
      rcs: rcsList,
      non_rcs,
      non_existing_items,
      total_amount,
      cgst,
      sgst,
      igst,
      createdBy,
    } = req.body;

    // Check if Service Request exists
    const serviceRequest = await ServiceRequestModal.findById(
      serviceRequestId
    ).populate("clientId");

    if (!serviceRequest) {
      return res.status(404).json({ message: "Service Request not found." });
    }

    let non_rcs_new = non_rcs?.length ? [...non_rcs] : [];
    let rcs = rcsList?.length ? [...rcsList] : [];

    if (non_existing_items?.length) {
      for (let i = 0; i < non_existing_items.length; i++) {
        const item = non_existing_items[i];
        // console.log(item, "itemmm");

        const itemAdded = await ItemModel.create({
          ...item,
          servicePartnerId: serviceRequest?.servicePartnerId,
        });

        // console.log(itemAdded, "itemAdded");

        if (itemAdded?._id) {
          if (item?.rc && !item?.rc_id) {
            const rcAdded = await RcModal.create({
              rc_number: item?.rc,
              inventory_id: itemAdded?._id,
              finished_goods: "",
              rate: item?.rate,
              gstPercentage: item?.gstPercentage,
              unit: item?.unit,
              clientId: serviceRequest?.clientId,
              servicePartnerId: serviceRequest?.servicePartnerId,
            });
            rcs.push({
              rc_id: rcAdded?._id?.toString(),
              qty: item.qty,
              remarks: item.remarks,
              additional_description: item.additional_description,
            });
          } else {
            non_rcs_new.push({
              inventory_id: itemAdded?._id?.toString(),
              qty: item.qty,
              remarks: item.remarks,
              additional_description: item.additional_description,
            });
          }
        }
      }
    }

    // console.log(non_rcs_new, "non_rcs_new");

    const quotation = new QuotationModel({
      serviceRequestId,
      rcs,
      non_rcs: non_rcs_new,
      total_amount,
      cgst,
      sgst,
      igst,
      quotationNumber: await generateRequestNumber(
        "QT",
        serviceRequest?.clientId?.client_name,
        QuotationModel,
        "quotationNumber"
      ),
      createdBy: createdBy,
    });
    await quotation.save();

    res
      .status(201)
      .json({ message: "Quotation created successfully.", data: quotation });
  } catch (error) {
    console.log(error, "error");

    res
      .status(500)
      .json({ message: "Error creating quotation.", error: error.message });
  }
};

// Get all Quotations
const mongoose = require("mongoose");

const getAllQuotations = async (req, res) => {
  try {
    let { servicePartnerId, serviceIds, ...rest } = req.query;

    // Convert any _id fields in rest to ObjectId if needed
    const matchStage = {};
    for (const key in rest) {
      matchStage[key] = mongoose.Types.ObjectId.isValid(rest[key])
        ? new mongoose.Types.ObjectId(rest[key])
        : rest[key];
    }

    const serviceQuery = serviceIds
      ? { service_id: { $in: serviceIds?.split(",") } }
      : {};

    const aggregationPipeline = [
      // Match serviceIds if provided
      {
        $addFields: {
          service_id: {
            $toString: "$serviceRequestId",
          },
        },
      },
      { $match: { ...matchStage, ...serviceQuery } },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy",
        },
      },
      {
        $addFields: {
          createdBy: { $arrayElemAt: ["$createdBy", 0] },
        },
      },
      {
        $lookup: {
          from: "servicerequests",
          localField: "serviceRequestId",
          foreignField: "_id",
          as: "serviceRequestId",
        },
      },
      { $unwind: "$serviceRequestId" },

      // Optional filter by servicePartnerId
      ...(servicePartnerId
        ? [
            {
              $match: {
                "serviceRequestId.servicePartnerId":
                  new mongoose.Types.ObjectId(servicePartnerId),
              },
            },
          ]
        : []),

      // Lookups for serviceRequestId nested fields
      {
        $lookup: {
          from: "branches",
          localField: "serviceRequestId.branch_id",
          foreignField: "_id",
          as: "serviceRequestId.branch_id",
        },
      },
      {
        $lookup: {
          from: "clients",
          localField: "serviceRequestId.clientId",
          foreignField: "_id",
          as: "serviceRequestId.clientId",
        },
      },
      {
        $lookup: {
          from: "servicepartners",
          localField: "serviceRequestId.servicePartnerId",
          foreignField: "_id",
          as: "serviceRequestId.servicePartnerId",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "serviceRequestId.clientUserId",
          foreignField: "_id",
          as: "serviceRequestId.clientUserId",
        },
      },
      // Flatten arrays
      {
        $addFields: {
          "serviceRequestId.branch_id": {
            $arrayElemAt: ["$serviceRequestId.branch_id", 0],
          },
          "serviceRequestId.clientId": {
            $arrayElemAt: ["$serviceRequestId.clientId", 0],
          },
          "serviceRequestId.servicePartnerId": {
            $arrayElemAt: ["$serviceRequestId.servicePartnerId", 0],
          },
          "serviceRequestId.clientUserId": {
            $arrayElemAt: ["$serviceRequestId.clientUserId", 0],
          },
        },
      },

      // Lookup rcs.rc_id
      {
        $unwind: {
          path: "$rcs",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "rcs",
          localField: "rcs.rc_id",
          foreignField: "_id",
          as: "rcs.rc_id",
        },
      },
      {
        $unwind: {
          path: "$rcs.rc_id",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "items",
          localField: "rcs.rc_id.inventory_id",
          foreignField: "_id",
          as: "rcs.rc_id.inventory_id",
        },
      },
      {
        $addFields: {
          "rcs.rc_id.inventory_id": {
            $arrayElemAt: ["$rcs.rc_id.inventory_id", 0],
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          doc: { $first: "$$ROOT" },
          rcs: { $push: "$rcs" },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ["$doc", { rcs: "$rcs" }],
          },
        },
      },

      // Lookup non_rcs.inventory_id
      {
        $unwind: {
          path: "$non_rcs",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "items",
          localField: "non_rcs.inventory_id",
          foreignField: "_id",
          as: "non_rcs.inventory_id",
        },
      },
      {
        $addFields: {
          "non_rcs.inventory_id": {
            $arrayElemAt: ["$non_rcs.inventory_id", 0],
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          doc: { $first: "$$ROOT" },
          non_rcs: { $push: "$non_rcs" },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ["$doc", { non_rcs: "$non_rcs" }],
          },
        },
      },

      { $sort: { createdAt: -1 } },
    ];

    const quotations = await QuotationModel.aggregate(aggregationPipeline);

    res.status(200).json({ data: quotations });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching quotations.",
      error: error.message,
    });
  }
};

// Get Quotation by ID
const getQuotationById = async (req, res) => {
  try {
    const { id } = req.params;
    const quotation = await QuotationModel.findById(id)
      .populate({
        path: "serviceRequestId",
        populate: {
          path: "branch_id clientId servicePartnerId clientUserId",
        },
      })
      .populate([
        {
          path: "rcs.rc_id",
          populate: {
            path: "inventory_id",
          },
        },
        {
          path: "non_rcs.inventory_id",
        },
      ]);

    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found." });
    }

    res.status(200).json({ data: quotation });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching quotation.", error: error.message });
  }
};
const getTasks = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the tasks and populate both serviceRequestId and itemId
    const tasks = await AssignServiceModel.findOne({ serviceId: id })
      .populate("serviceId")
      .populate({
        path: "inventories.inventory_id",
      });
    if (!tasks) {
      return res.status(404).json({ message: "Tasks not found." });
    }

    res.status(200).json({ data: tasks });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching quotation.", error: error.message });
  }
};

// Update a Quotation
const updateQuotation = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      serviceRequestId,
      rcs: rcsList,
      non_rcs,
      non_existing_items,
      servicePartnerId,
      rfqId,
      vendorId,
      items,
      amount,
      ...rest
    } = req?.body;

    // Handle new payload format with rfqId, vendorId, items, and amount
    if (rfqId && vendorId && items && amount) {
      // Process items from the new payload format
      let non_rcs_new = [];
      let rcs = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Check if item already exists using itemId
        const existingItem = await ItemModel.findById(item.itemId);

        if (existingItem) {
          // If item exists, add to non_rcs with the new structure
          non_rcs_new.push({
            inventory_id: item.itemId,
            qty: item.quantity,
            remarks: item.remarks || "",
            additional_description: item.additional_description || "",
            price: item.price,
            hsnCode: item.hsnCode,
            unit: item.unit,
          });
        } else {
          // If item doesn't exist, create it first
          const newItem = await ItemModel.create({
            item_name: item.itemName,
            unit: item.unit,
            rate: item.price,
            hsnCode: item.hsnCode,
            servicePartnerId: servicePartnerId,
          });

          non_rcs_new.push({
            inventory_id: newItem._id.toString(),
            qty: item.quantity,
            remarks: item.remarks || "",
            additional_description: item.additional_description || "",
            price: item.price,
            hsnCode: item.hsnCode,
            unit: item.unit,
          });
        }
      }

      const updatedQuotation = await QuotationModel.findByIdAndUpdate(
        id,
        {
          ...rest,
          non_rcs: non_rcs_new,
          rcs: rcs,
          rfqId: rfqId,
          vendorId: vendorId,
          total_amount: amount,
        },
        { new: true }
      );

      if (!updatedQuotation) {
        return res.status(404).json({ message: "Quotation not found." });
      }

      return res.status(200).json({
        message: "Quotation updated successfully.",
        data: updatedQuotation,
      });
    }

    // Handle existing payload format
    const serviceRequest = await ServiceRequestModal.findById(
      serviceRequestId
    ).populate("clientId");

    if (!serviceRequest) {
      return res.status(404).json({ message: "Service Request not found." });
    }

    let non_rcs_new = non_rcs?.length ? [...non_rcs] : [];
    let rcs = rcsList?.length ? [...rcsList] : [];

    // console.log(non_existing_items, "non_existing_items");
    // console.log(rcs, "rcs");

    if (non_existing_items?.length) {
      for (let i = 0; i < non_existing_items.length; i++) {
        const item = non_existing_items[i];
        // console.log(item, "itemmm");

        const itemAdded = await ItemModel.create({
          ...item,
          servicePartnerId: serviceRequest?.servicePartnerId,
        });

        // console.log(itemAdded, "itemAdded");

        if (itemAdded?._id) {
          if (item?.rc && !item?.rc_id) {
            const rcAdded = await RcModal.create({
              rc_number: item?.rc,
              inventory_id: itemAdded?._id,
              finished_goods: "",
              rate: item?.rate,
              gstPercentage: item?.gstPercentage,
              unit: item?.unit,
              clientId: serviceRequest?.clientId,
              servicePartnerId: serviceRequest?.servicePartnerId,
            });
            rcs.push({
              rc_id: rcAdded?._id?.toString(),
              qty: item.qty,
              remarks: item.remarks,
              additional_description: item.additional_description,
            });
          } else {
            non_rcs_new.push({
              inventory_id: itemAdded?._id?.toString(),
              qty: item.qty,
              remarks: item.remarks,
              additional_description: item.additional_description,
            });
          }
        }
      }
    }

    // let non_rcs_new = non_rcs?.length ? [...non_rcs] : [];
    // if (non_existing_items?.length) {
    //   const items = await ItemModel.insertMany(
    //     non_existing_items?.map((item) => ({
    //       ...item,
    //       servicePartnerId,
    //     }))
    //   );
    //   non_rcs_new = [
    //     ...non_rcs,
    //     ...items.map((item) => ({
    //       inventory_id: item?._id?.toString(),
    //       qty: item.qty,
    //       remarks: item.remarks,
    //     })),
    //   ];
    // }

    const updatedQuotation = await QuotationModel.findByIdAndUpdate(
      id,
      { ...rest, non_rcs: non_rcs_new, rcs },
      { new: true }
    );

    if (!updatedQuotation) {
      return res.status(404).json({ message: "Quotation not found." });
    }

    res.status(200).json({
      message: "Quotation updated successfully.",
      data: updatedQuotation,
    });
  } catch (error) {
    console.log(error, "error");

    res
      .status(500)
      .json({ message: "Error updating quotation.", error: error.message });
  }
};

// Delete a Quotation
const deleteQuotation = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedQuotation = await QuotationModel.findByIdAndDelete(id);

    if (!deletedQuotation) {
      return res.status(404).json({ message: "Quotation not found." });
    }

    res.status(200).json({ message: "Quotation deleted successfully." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting quotation.", error: error.message });
  }
};
// Get Quotation by Service Request ID
const getQuotationByServiceId = async (req, res) => {
  try {
    const { serviceRequestId } = req.params;

    const quotation = await QuotationModel.findOne({
      serviceRequestId,
    }).populate("serviceRequestId");

    if (!quotation) {
      return res.status(404).json({
        message: "Quotation not found for the provided Service Request ID.",
      });
    }

    res.status(200).json({ data: quotation });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching quotation.", error: error.message });
  }
};

// Update Quotation by Service Request ID
const updateQuotationByServiceId = async (req, res) => {
  try {
    const { serviceRequestId } = req.params;
    const { rcs } = req.body;

    // Validate rcs
    if (!rcs || rcs.length === 0) {
      return res
        .status(400)
        .json({ message: "Items are required to update the quotation." });
    }

    const updatedQuotation = await QuotationModel.findOneAndUpdate(
      { serviceRequestId },
      { rcs },
      { new: true }
    );

    if (!updatedQuotation) {
      return res.status(404).json({
        message: "Quotation not found for the provided Service Request ID.",
      });
    }

    res.status(200).json({
      message: "Quotation updated successfully.",
      data: updatedQuotation,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating quotation.", error: error.message });
  }
};

const updateItemDetails = async (req, res) => {
  const { serviceId } = req.params;
  const { completionStatus, usedQty, inventory_id } = req.body;

  try {
    // Validate input
    if (!completionStatus && usedQty === undefined) {
      return res.status(400).json({
        error: "completionStatus or usedQty must be provided.",
      });
    }

    // Find the quotation and update the specific item
    const updatedTask = await AssignServiceModel.findOneAndUpdate(
      { serviceId: serviceId, "inventories.inventory_id": inventory_id },
      {
        $set: {
          "inventories.$.completionStatus": completionStatus,
          "inventories.$.completionDate": new Date(),
          "inventories.$.usedQty": usedQty,
        },
      },
      { new: true } // Return the updated document
    );

    // If no quotation or item is found, return an error
    if (!updatedTask) {
      return res.status(404).json({ message: "Service or item not found." });
    }

    // Return the updated quotation
    res.status(200).json({
      message: "Item updated successfully.",
      data: updatedTask,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "An error occurred while updating the item.",
      error: error.message,
    });
  }
};
/**
 * Update completionStatus and completionDate for a single RC or non-RC item in a quotation
 * @route PATCH /quotation/:quotationId/item
 * @body { type: "rc" | "non_rc", itemId: ObjectId, completionStatus: Boolean, completionDate?: Date }
 */
const updateQuotationItemStatus = async (req, res) => {
  try {
    const { quotationId } = req.params;
    const { type, itemId, completionStatus, completionDate } = req.body;

    if (!["rc", "non_rc"].includes(type)) {
      return res
        .status(400)
        .json({ message: "Invalid type. Must be 'rc' or 'non_rc'." });
    }
    if (!itemId) {
      return res.status(400).json({ message: "itemId is required." });
    }

    let updateQuery;
    if (type === "rc") {
      updateQuery = {
        $set: {
          "rcs.$.completionStatus": completionStatus,
          "rcs.$.completionDate": completionDate || new Date(),
        },
      };
    } else {
      updateQuery = {
        $set: {
          "non_rcs.$.completionStatus": completionStatus,
          "non_rcs.$.completionDate": completionDate || new Date(),
        },
      };
    }

    const filter =
      type === "rc"
        ? { _id: quotationId, "rcs.rc_id": itemId }
        : { _id: quotationId, "non_rcs.inventory_id": itemId };

    const updatedQuotation = await QuotationModel.findOneAndUpdate(
      filter,
      updateQuery,
      { new: true }
    );

    if (!updatedQuotation) {
      return res.status(404).json({ message: "Quotation or item not found." });
    }

    res.status(200).json({
      message: "Item status updated successfully.",
      data: updatedQuotation,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating item status.",
      error: error.message,
    });
  }
};

/**
 * Get all RCs and non-RCs as a single list for a particular serviceRequestId
 * @route GET /quotation/items/:serviceRequestId
 */
const getAllQuotationItemsByServiceId = async (req, res) => {
  try {
    const { serviceRequestId } = req.params;

    // Find the quotation for the given serviceRequestId and populate rc_id and inventory_id
    const quotation = await QuotationModel.findOne({ serviceRequestId })
      .populate({
        path: "rcs.rc_id",
        populate: { path: "inventory_id" },
      })
      .populate({
        path: "non_rcs.inventory_id",
      });

    if (!quotation) {
      return res.status(404).json({
        message: "Quotation not found for the provided Service Request ID.",
      });
    }

    // Prepare a unified list with a type field
    const rcs = (quotation.rcs || []).map((item) => ({
      ...item.toObject(),
      type: "rc",
    }));
    const non_rcs = (quotation.non_rcs || []).map((item) => ({
      ...item.toObject(),
      type: "non_rc",
    }));

    const allItems = [...rcs, ...non_rcs];
    res.status(200).json({
      message: "Items fetched successfully.",
      data: allItems,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching items.",
      error: error.message,
    });
  }
};

module.exports = {
  createQuotation,
  getAllQuotations,
  getQuotationById,
  updateQuotation,
  deleteQuotation,
  getQuotationByServiceId,
  updateQuotationByServiceId,
  updateItemDetails,
  getTasks,
  updateQuotationItemStatus,
  getAllQuotationItemsByServiceId,
};
