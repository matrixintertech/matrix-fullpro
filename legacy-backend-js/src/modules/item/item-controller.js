const ItemModel = require("./item-model");

// Create a New Item
const createItem = async (req, res) => {
  try {
    const {
      itemName,
      category,
      hsnCode,
      gstPercentage,
      unit,
      qty,
      inventoryType,
      servicePartnerId,
      additional_description,
    } = req.body;

    const newItem = new ItemModel({
      itemName,
      category,
      hsnCode,
      gstPercentage,
      inventoryType,
      unit,
      qty,
      servicePartnerId,
      additional_description,
    });

    await newItem.save();
    res
      .status(201)
      .json({ message: "Item created successfully.", data: newItem });
  } catch (error) {
    console.log(error);

    res
      .status(500)
      .json({ message: "Error creating item.", error: error.message });
  }
};
const createMultipleItems = async (req, res) => {
  try {
    const { items } = req.body;

    const newItems = await ItemModel?.insertMany(items);

    res
      .status(201)
      .json({ message: "Items created successfully.", data: newItems });
  } catch (error) {
    console.log(error);

    res
      .status(500)
      .json({ message: "Error creating item.", error: error.message });
  }
};

const searchItems = async (req, res) => {
  try {
    const { search, ...rest } = req?.query;

    if (!search) {
      return res.status(400).json({ message: "Query parameter is required" });
    }

    const inventoryItems = await ItemModel.find({
      itemName: { $regex: search, $options: "i" },
      ...rest,
    });

    return res.status(200).json({ source: "inventory", data: inventoryItems });
  } catch (error) {
    console.error("Error in search API:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Get All Items
const getAllItems = async (req, res) => {
  try {
    const query = req?.query;

    const items = await ItemModel.aggregate([
      {
        $addFields: {
          servicePartnerId: { $toString: "$servicePartnerId" },
        },
      },
      { $match: query },
      {
        $lookup: {
          from: "inventories",
          let: { itemId: "$_id" },
          pipeline: [
            { $unwind: "$items" },
            {
              $match: {
                $expr: {
                  $eq: ["$items.inventory_id", "$$itemId"],
                },
              },
            },
            {
              $project: {
                record_type: 1,
                "items.qty_in": 1,
                "items.qty_out": 1,
              },
            },
          ],
          as: "inventoryData",
        },
      },
      {
        $addFields: {
          total_inventory_in: {
            $sum: {
              $map: {
                input: "$inventoryData",
                as: "inv",
                in: {
                  $cond: [
                    { $eq: ["$$inv.record_type", "inventory_in"] },
                    "$$inv.items.qty_in",
                    0,
                  ],
                },
              },
            },
          },
          total_inventory_out: {
            $sum: {
              $map: {
                input: "$inventoryData",
                as: "inv",
                in: {
                  $cond: [
                    { $eq: ["$$inv.record_type", "inventory_out"] },
                    "$$inv.items.qty_out",
                    0,
                  ],
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          available_quantity: {
            $subtract: ["$total_inventory_in", "$total_inventory_out"],
          },
        },
      },
      {
        $project: {
          inventoryData: 0,
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    res.status(200).json({ data: items });
  } catch (error) {
    console.log("getAllItems error:", error);

    res.status(500).json({
      message: "Error fetching items.",
      error: error.message,
    });
  }
};

// Get Item by ID
const getItemById = async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await ItemModel.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found." });
    }

    res.status(200).json({ data: item });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching item.", error: error.message });
  }
};

// Update Item by ID
const updateItemById = async (req, res) => {
  try {
    const { itemId } = req.params;
    const updates = req.body;

    const updatedItem = await ItemModel.findByIdAndUpdate(itemId, updates, {
      new: true,
    });
    if (!updatedItem) {
      return res.status(404).json({ message: "Item not found." });
    }

    res
      .status(200)
      .json({ message: "Item updated successfully.", data: updatedItem });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating item.", error: error.message });
  }
};

// Delete Item by ID
const deleteItemById = async (req, res) => {
  try {
    const { itemId } = req.params;

    const deletedItem = await ItemModel.findByIdAndDelete(itemId);
    if (!deletedItem) {
      return res.status(404).json({ message: "Item not found." });
    }

    res.status(200).json({ message: "Item deleted successfully." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting item.", error: error.message });
  }
};

module.exports = {
  searchItems,
  createMultipleItems,
  createItem,
  getAllItems,
  getItemById,
  updateItemById,
  deleteItemById,
};
