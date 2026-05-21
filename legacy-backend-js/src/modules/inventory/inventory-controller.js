const { default: mongoose } = require("mongoose");
const AssignServiceModel = require("../assign-serivce/assign-service-model");
const InventoryModel = require("./inventory-model");
const {
  InventoryRequestModal,
} = require("../inventory-request/inventory-request-modal");
const { SiteModel } = require("./site-model");

const createInventory = async (req, res) => {
  try {
    let inventoriesOut = [];
    // Handle both direct payload and inventories array
    const inventoriesArray = req?.body?.inventories || [req?.body];
    const is_not_godown = inventoriesArray?.some(
      (inventory) => !inventory?.is_godown && inventory?.service_request
    );

    if (
      is_not_godown &&
      !inventoriesArray?.find(
        (inventory) => inventory?.record_type === "inventory_out"
      )
    ) {
      // Handle direct payload structure or inventories array
      const firstInventory = req?.body?.inventories?.[0] || req?.body;

      // Handle site creation/lookup if siteName is provided and site ID is not provided
      let siteId = firstInventory?.site;
      let siteName = firstInventory?.siteName;

      if (siteName && !siteId) {
        try {
          // Check if site already exists
          const existingSite = await SiteModel.findOne({
            name: siteName,
          });

          if (existingSite) {
            // If site exists, use its ID
            siteId = existingSite._id;
          } else {
            // Create new site if it doesn't exist
            const newSite = await SiteModel.create({
              name: siteName,
            });
            siteId = newSite._id;
          }
        } catch (siteError) {
          // Log the site creation error but don't fail the entire inventory creation
          console.log("Site creation/lookup error:", siteError.message);
        }
      }

      const inventory_in_to_add = {
        inventory_request_id: firstInventory?.inventory_request_id,
        servicePartnerId: firstInventory?.servicePartnerId,
        record_type: firstInventory?.record_type,
        inventory_type: firstInventory?.inventory_type,
        service_request: firstInventory?.service_request,
        received_by: firstInventory?.received_by,
        is_godown: firstInventory?.is_godown,
        bill_no: firstInventory?.bill_no,
        bill_date: firstInventory?.bill_date,
        bill_attachment: firstInventory?.bill_attachment,
        person_name: firstInventory?.person_name,
        supplier_id: firstInventory?.supplier_id,
        inventory_out_date: firstInventory?.inventory_out_date,
        site: siteId, // Use the resolved site ID
        siteName: siteName, // Keep the site name
        outerRemarks: firstInventory?.outerRemarks,

        items: req?.body?.inventories?.map((inventory) => ({
          inventory_id: inventory?.inventory_id,
          qty_out: 0,
          rate: inventory?.rate,
          qty_in: inventory?.qty_in,
          remarks: inventory?.remarks,
        })),
      };
      // console.log(inventory_in_to_add, "inventory_in_to_add");
      const createdInventory = await InventoryModel.create(inventory_in_to_add);

      // Update the site with inventory reference if we created or found a site
      if (siteId) {
        try {
          await SiteModel.findByIdAndUpdate(
            siteId,
            { inventoryId: createdInventory._id },
            { new: true }
          );
        } catch (siteUpdateError) {
          console.log("Site update error:", siteUpdateError.message);
        }
      }
    } else {
      // Handle direct payload structure or inventories array
      const firstInventory = req?.body?.inventories?.[0] || req?.body;

      // Handle site creation/lookup if siteName is provided and site ID is not provided
      let siteId = firstInventory?.site;
      let siteName = firstInventory?.siteName;

      if (siteName && !siteId) {
        try {
          // Check if site already exists
          const existingSite = await SiteModel.findOne({
            name: siteName,
          });

          if (existingSite) {
            // If site exists, use its ID
            siteId = existingSite._id;
          } else {
            // Create new site if it doesn't exist
            const newSite = await SiteModel.create({
              name: siteName,
            });
            siteId = newSite._id;
          }
        } catch (siteError) {
          // Log the site creation error but don't fail the entire inventory creation
          console.log("Site creation/lookup error:", siteError.message);
        }
      }

      const inventory_in_to_add = {
        servicePartnerId: firstInventory?.servicePartnerId,
        record_type: firstInventory?.record_type,
        inventory_type: firstInventory?.inventory_type,
        inventory_request_id: firstInventory?.inventory_request_id,
        service_request: firstInventory?.service_request,
        received_by: firstInventory?.received_by,
        is_godown: firstInventory?.is_godown,
        bill_no: firstInventory?.bill_no,
        bill_date: firstInventory?.bill_date,
        bill_attachment: firstInventory?.bill_attachment,
        person_name: firstInventory?.person_name,
        supplier_id: firstInventory?.supplier_id,
        inventory_out_date: firstInventory?.inventory_out_date,
        site: siteId, // Use the resolved site ID
        siteName: siteName, // Keep the site name
        outerRemarks: firstInventory?.outerRemarks,
        items: req?.body?.inventories
          ? req?.body?.inventories?.map((inventory) => ({
              inventory_id: inventory?.inventory_id,
              qty_out: inventory?.qty_out,
              qty_in: inventory?.qty_in,
              rate: inventory?.rate,
              remarks: inventory?.remarks,
            }))
          : [
              {
                inventory_id: firstInventory?.inventory_id,
                qty_out: firstInventory?.qty_out,
                qty_in: firstInventory?.qty_in,
                rate: firstInventory?.rate,
                remarks: firstInventory?.remarks,
              },
            ],
      };
      // console.log(inventory_in_to_add, "inventory_in_to_add");
      const createdInventory = await InventoryModel.create(inventory_in_to_add);

      // Update the site with inventory reference if we created or found a site
      if (siteId) {
        try {
          await SiteModel.findByIdAndUpdate(
            siteId,
            { inventoryId: createdInventory._id },
            { new: true }
          );
        } catch (siteUpdateError) {
          console.log("Site update error:", siteUpdateError.message);
        }
      }
    }

    const firstInventoryForStatus = inventoriesArray?.[0];
    if (firstInventoryForStatus?.inventory_request_id) {
      InventoryRequestModal.findOneAndUpdate(
        { _id: firstInventoryForStatus?.inventory_request_id },
        { status: "Fulfilled" },
        { new: true }
      );
    }

    const inventory_out_to_issue = is_not_godown
      ? inventoriesOut?.filter(
          (inventory) =>
            inventory?.record_type === "inventory_out" &&
            inventory?.inventory_type === "Issued"
        )
      : inventoriesArray?.filter(
          (inventory) =>
            inventory?.record_type === "inventory_out" &&
            inventory?.inventory_type === "Issued"
        );

    let service_id_mapped_inventories = {};

    inventory_out_to_issue?.forEach((inventory) => {
      if (service_id_mapped_inventories?.[inventory?.service_request]) {
        service_id_mapped_inventories?.[inventory?.service_request]?.push({
          inventory_id: inventory?.inventory_id,
          qty: inventory?.qty_out,
        });
      } else {
        service_id_mapped_inventories[inventory?.service_request] = [
          { inventory_id: inventory?.inventory_id, qty: inventory?.qty_out },
        ];
      }
    });

    for (
      let i = 0;
      i < Object.keys(service_id_mapped_inventories)?.length;
      i++
    ) {
      const service_id = Object.keys(service_id_mapped_inventories)?.[i];

      const inventories = service_id_mapped_inventories?.[service_id];

      // await AssignServiceModel.insertMany({
      //   serviceId: service_id,
      //   inventories,
      // });
    }

    res.status(201).json({
      message: "Inventories created successfully.",
      success: true,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating inventory.", error: error.message });
  }
};

// Get All Inventories
const getAllInventories = async (req, res) => {
  try {
    const query = { ...req.query };

    const objectIdFields = [
      "inventory_request_id",
      "supplier_id",
      "received_by",
      "service_request",
      "servicePartnerId",
    ];
    objectIdFields.forEach((field) => {
      if (query[field]) {
        query[field] = new mongoose.Types.ObjectId(query[field]);
      }
    });

    const matchStage = Object.keys(query).length ? { $match: query } : {};

    const inventories = await InventoryModel.aggregate([
      matchStage,

      // Lookup Supplier
      {
        $lookup: {
          from: "suppliers",
          localField: "supplier_id",
          foreignField: "_id",
          as: "supplier_id",
        },
      },
      { $unwind: { path: "$supplier_id", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "inventoryrequests",
          localField: "inventory_request_id",
          foreignField: "_id",
          as: "inventory_request_id",
        },
      },
      {
        $unwind: {
          path: "$inventory_request_id",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Lookup User
      {
        $lookup: {
          from: "users",
          localField: "received_by",
          foreignField: "_id",
          as: "received_by",
        },
      },
      { $unwind: { path: "$received_by", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "person_name",
          foreignField: "_id",
          as: "person_name",
        },
      },
      { $unwind: { path: "$person_name", preserveNullAndEmptyArrays: true } },

      // Lookup ServiceRequest
      {
        $lookup: {
          from: "servicerequests",
          localField: "service_request",
          foreignField: "_id",
          as: "service_request",
        },
      },
      {
        $unwind: { path: "$service_request", preserveNullAndEmptyArrays: true },
      },

      // Unwind items
      { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },

      // Lookup Item (inventory_id)
      {
        $lookup: {
          from: "items",
          localField: "items.inventory_id",
          foreignField: "_id",
          as: "items.inventory_id",
        },
      },
      {
        $unwind: {
          path: "$items.inventory_id",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Add GST calculations and amounts
      {
        $addFields: {
          // Get GST percentage from populated inventory item
          "items.gstPercentage": {
            $ifNull: ["$items.inventory_id.gstPercentage", 0],
          },

          // Calculate quantity based on record type (qty_out for inventory_out, qty_in for inventory_in)
          "items.quantity": {
            $ifNull: [
              {
                $cond: [
                  { $eq: ["$record_type", "inventory_in"] },
                  "$items.qty_in",
                  "$items.qty_out",
                ],
              },
              0,
            ],
          },

          // Amount without GST = qty * rate
          "items.amount_without_gst": {
            $multiply: [
              {
                $ifNull: [
                  {
                    $cond: [
                      { $eq: ["$record_type", "inventory_in"] },
                      "$items.qty_in",
                      "$items.qty_out",
                    ],
                  },
                  0,
                ],
              },
              { $ifNull: ["$items.rate", 0] },
            ],
          },

          // GST Amount = (amount without GST * GST%) / 100
          "items.gst_amount": {
            $divide: [
              {
                $multiply: [
                  {
                    $multiply: [
                      {
                        $ifNull: [
                          {
                            $cond: [
                              { $eq: ["$record_type", "inventory_in"] },
                              "$items.qty_in",
                              "$items.qty_out",
                            ],
                          },
                          0,
                        ],
                      },
                      { $ifNull: ["$items.rate", 0] },
                    ],
                  },
                  { $ifNull: ["$items.inventory_id.gstPercentage", 0] },
                ],
              },
              100,
            ],
          },

          // // CGST = GST Amount / 2 (for intra-state transactions)
          // "items.cgst": {
          //   $divide: [
          //     {
          //       $divide: [
          //         {
          //           $multiply: [
          //             {
          //               $multiply: [
          //                 {
          //                   $ifNull: [
          //                     {
          //                       $cond: [
          //                         { $eq: ["$record_type", "inventory_in"] },
          //                         "$items.qty_in",
          //                         "$items.qty_out",
          //                       ],
          //                     },
          //                     0,
          //                   ],
          //                 },
          //                 { $ifNull: ["$items.rate", 0] },
          //               ],
          //             },
          //             { $ifNull: ["$items.inventory_id.gstPercentage", 0] },
          //           ],
          //         },
          //         100,
          //       ],
          //     },
          //     2,
          //   ],
          // },

          // // SGST = GST Amount / 2 (for intra-state transactions)
          // "items.sgst": {
          //   $divide: [
          //     {
          //       $divide: [
          //         {
          //           $multiply: [
          //             {
          //               $multiply: [
          //                 {
          //                   $ifNull: [
          //                     {
          //                       $cond: [
          //                         { $eq: ["$record_type", "inventory_in"] },
          //                         "$items.qty_in",
          //                         "$items.qty_out",
          //                       ],
          //                     },
          //                     0,
          //                   ],
          //                 },
          //                 { $ifNull: ["$items.rate", 0] },
          //               ],
          //             },
          //             { $ifNull: ["$items.inventory_id.gstPercentage", 0] },
          //           ],
          //         },
          //         100,
          //       ],
          //     },
          //     2,
          //   ],
          // },

          // // IGST = GST Amount (for inter-state transactions)
          // "items.igst": {
          //   $divide: [
          //     {
          //       $multiply: [
          //         {
          //           $multiply: [
          //             {
          //               $ifNull: [
          //                 {
          //                   $cond: [
          //                     { $eq: ["$record_type", "inventory_in"] },
          //                     "$items.qty_in",
          //                     "$items.qty_out",
          //                   ],
          //                 },
          //                 0,
          //               ],
          //             },
          //             { $ifNull: ["$items.rate", 0] },
          //           ],
          //         },
          //         { $ifNull: ["$items.inventory_id.gstPercentage", 0] },
          //       ],
          //     },
          //     100,
          //   ],
          // },

          // Amount with GST = Amount without GST + GST Amount
          "items.amount_with_gst": {
            $add: [
              {
                $multiply: [
                  {
                    $ifNull: [
                      {
                        $cond: [
                          { $eq: ["$record_type", "inventory_in"] },
                          "$items.qty_in",
                          "$items.qty_out",
                        ],
                      },
                      0,
                    ],
                  },
                  { $ifNull: ["$items.rate", 0] },
                ],
              },
              {
                $divide: [
                  {
                    $multiply: [
                      {
                        $multiply: [
                          {
                            $ifNull: [
                              {
                                $cond: [
                                  { $eq: ["$record_type", "inventory_in"] },
                                  "$items.qty_in",
                                  "$items.qty_out",
                                ],
                              },
                              0,
                            ],
                          },
                          { $ifNull: ["$items.rate", 0] },
                        ],
                      },
                      { $ifNull: ["$items.inventory_id.gstPercentage", 0] },
                    ],
                  },
                  100,
                ],
              },
            ],
          },

          // Keep item_total for backward compatibility (same as amount_with_gst)
          "items.item_total": {
            $add: [
              {
                $multiply: [
                  {
                    $ifNull: [
                      {
                        $cond: [
                          { $eq: ["$record_type", "inventory_in"] },
                          "$items.qty_in",
                          "$items.qty_out",
                        ],
                      },
                      0,
                    ],
                  },
                  { $ifNull: ["$items.rate", 0] },
                ],
              },
              {
                $divide: [
                  {
                    $multiply: [
                      {
                        $multiply: [
                          {
                            $ifNull: [
                              {
                                $cond: [
                                  { $eq: ["$record_type", "inventory_in"] },
                                  "$items.qty_in",
                                  "$items.qty_out",
                                ],
                              },
                              0,
                            ],
                          },
                          { $ifNull: ["$items.rate", 0] },
                        ],
                      },
                      { $ifNull: ["$items.inventory_id.gstPercentage", 0] },
                    ],
                  },
                  100,
                ],
              },
            ],
          },
        },
      },

      // Group items and calculate totals
      {
        $group: {
          _id: "$_id",
          doc: { $first: "$$ROOT" },
          totalAmount: { $sum: "$items.item_total" },
          totalAmountWithoutGST: { $sum: "$items.amount_without_gst" },
          totalAmountWithGST: { $sum: "$items.amount_with_gst" },
          totalGSTAmount: { $sum: "$items.gst_amount" },
          totalCGST: { $sum: "$items.cgst" },
          totalSGST: { $sum: "$items.sgst" },
          totalIGST: { $sum: "$items.igst" },
          items: { $push: "$items" },
        },
      },

      // Merge doc and calculated fields
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$doc",
              {
                totalAmount: "$totalAmount",
                totalAmountWithoutGST: "$totalAmountWithoutGST",
                totalAmountWithGST: "$totalAmountWithGST",
                totalGSTAmount: "$totalGSTAmount",
                totalCGST: "$totalCGST",
                totalSGST: "$totalSGST",
                totalIGST: "$totalIGST",
                items: "$items",
              },
            ],
          },
        },
      },

      // Sort by newest
      { $sort: { createdAt: -1 } },
    ]);

    res.status(200).json({ data: inventories });
  } catch (error) {
    console.log(error, "errorerror");
    res
      .status(500)
      .json({ message: "Error fetching inventories.", error: error.message });
  }
};

const getAvailableQuantity = async (req, res) => {
  try {
    const result = await InventoryModel.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.inventory_id",
          total_in: { $sum: "$items.qty_in" },
          total_out: { $sum: "$items.qty_out" },
        },
      },
      {
        $project: {
          _id: 0,
          inventory_id: "$_id",
          available_qty: { $subtract: ["$total_in", "$total_out"] },
        },
      },
    ]);

    const available_quantities = result.reduce(
      (acc, { inventory_id, available_qty }) => {
        acc[inventory_id] = available_qty;
        return acc;
      },
      {}
    );
    // console.log(available_quantities, "available_quantities");

    res.json(available_quantities);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching inventories.", error: error.message });
  }
};

// Get Inventory by ID
const getInventoryById = async (req, res) => {
  try {
    const { inventoryId } = req.params;

    const inventory = await InventoryModel.findById(inventoryId).populate([
      "supplier_id",
      "items.inventory_id",
    ]);
    if (!inventory) {
      return res.status(404).json({ message: "Inventory not found." });
    }

    res.status(200).json({ data: inventory });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching inventory.", error: error.message });
  }
};

// Update Inventory by ID
const updateInventoryById = async (req, res) => {
  try {
    const { inventoryId } = req.params;
    let updates = req.body;

    // Handle nested inventories structure or direct payload
    if (
      updates.inventories &&
      Array.isArray(updates.inventories) &&
      updates.inventories.length > 0
    ) {
      const inventoryData = updates.inventories[0];

      // Extract the main inventory fields
      updates = {
        servicePartnerId: inventoryData.servicePartnerId,
        record_type: inventoryData.record_type,
        inventory_type: inventoryData.inventory_type,
        inventory_request_id: inventoryData.inventory_request_id,
        service_request: inventoryData.service_request,
        received_by: inventoryData.received_by,
        inventory_out_date: inventoryData.inventory_out_date,
        supplier_id: inventoryData.supplier_id,
        bill_no: inventoryData.bill_no,
        bill_date: inventoryData.bill_date,
        bill_attachment: inventoryData.bill_attachment,
        person_name: inventoryData.person_name,
        is_godown: inventoryData.is_godown,
        site: inventoryData.site,
        siteName: inventoryData.siteName,
        // Create items array with ALL inventory data from inventories array
        items: updates.inventories.map((inventoryItem) => ({
          inventory_id: inventoryItem.inventory_id,
          qty_in: inventoryItem.qty_in || 0,
          qty_out: inventoryItem.qty_out || 0,
          rate: inventoryItem.rate || 0,
          remarks: inventoryItem.remarks || "",
        })),
      };
    } else if (updates.items && Array.isArray(updates.items)) {
      // Handle direct items array structure (this is what the fixed frontend sends)
      // updates already contains the correct structure, no transformation needed
    } else if (updates.inventory_id) {
      // Handle direct payload structure
      const directData = updates;
      updates = {
        servicePartnerId: directData.servicePartnerId,
        record_type: directData.record_type,
        inventory_type: directData.inventory_type,
        inventory_request_id: directData.inventory_request_id,
        service_request: directData.service_request,
        received_by: directData.received_by,
        inventory_out_date: directData.inventory_out_date,
        supplier_id: directData.supplier_id,
        bill_no: directData.bill_no,
        bill_date: directData.bill_date,
        bill_attachment: directData.bill_attachment,
        person_name: directData.person_name,
        is_godown: directData.is_godown,
        site: directData.site,
        siteName: directData.siteName,
        // Create items array with the inventory data
        items: [
          {
            inventory_id: directData.inventory_id,
            qty_in: directData.qty_in || 0,
            qty_out: directData.qty_out || 0,
            rate: directData.rate || 0,
            remarks: directData.remarks || "",
          },
        ],
      };
    }

    // Make sure inventory_out_date can be updated
    if (typeof updates.inventory_out_date !== "undefined") {
      updates.inventory_out_date = updates.inventory_out_date;
    }

    const updatedInventory = await InventoryModel.findByIdAndUpdate(
      inventoryId,
      updates,
      {
        new: true,
      }
    );
    if (!updatedInventory) {
      return res.status(404).json({ message: "Inventory not found." });
    }

    res.status(200).json({
      message: "Inventory updated successfully.",
      success: true,
      data: updatedInventory,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating inventory.", error: error.message });
  }
};

// Delete Inventory by ID
const deleteInventoryById = async (req, res) => {
  try {
    const { inventoryId } = req.params;

    const deletedInventory = await InventoryModel.findByIdAndDelete(
      inventoryId
    );
    if (!deletedInventory) {
      return res.status(404).json({ message: "Inventory not found." });
    }

    res.status(200).json({ message: "Inventory deleted successfully." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting inventory.", error: error.message });
  }
};

const checkSite = async (req, res) => {
  try {
    const { search } = req.query;

    if (!search) {
      return res.status(400).json({ message: "Search parameter is required." });
    }

    // Search for sites that contain the search term (case-insensitive)
    const sites = await SiteModel.find({
      name: { $regex: search, $options: "i" },
    }).populate("inventoryId");

    if (sites.length > 0) {
      return res.status(200).json({ exists: true, sites });
    } else {
      return res.status(200).json({ exists: false, sites: [] });
    }
  } catch (error) {
    console.error("Error in checkSite:", error);
    res
      .status(500)
      .json({ message: "Error checking site.", error: error.message });
  }
};

const addSite = async (req, res) => {
  try {
    const { siteName, inventoryId } = req.body;

    if (!siteName) {
      return res.status(400).json({ message: "Site name is required." });
    }

    // Check if site already exists
    const existingSite = await SiteModel.findOne({ name: siteName });
    if (existingSite) {
      return res
        .status(409)
        .json({ message: "Site with this name already exists." });
    }

    const newSite = new SiteModel({ name: siteName, inventoryId });
    await newSite.save();

    res
      .status(201)
      .json({ message: "Site added successfully.", site: newSite });
  } catch (error) {
    console.error("Error in addSite:", error);
    if (error.code === 11000) {
      // Handle duplicate key error
      return res
        .status(409)
        .json({ message: "Site with this name already exists." });
    }
    res
      .status(500)
      .json({ message: "Error adding site.", error: error.message });
  }
};

module.exports = {
  createInventory,
  getAllInventories,
  getInventoryById,
  updateInventoryById,
  deleteInventoryById,
  getAvailableQuantity,
  checkSite,
  addSite,
};
