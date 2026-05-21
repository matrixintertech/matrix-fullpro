const express = require("express");
const router = express.Router();
const InventoryController = require("./inventory-controller");

router.post("/create-inventory", InventoryController.createInventory);
router.get("/get-inventories", InventoryController.getAllInventories);
router.get("/get-available-quantity", InventoryController.getAvailableQuantity);
router.get(
  "/get-inventories-by-id/:inventoryId",
  InventoryController.getInventoryById
);
router.post(
  "/update-inventory/:inventoryId",
  InventoryController.updateInventoryById
);
router.delete(
  "/delete-inventory/:inventoryId",
  InventoryController.deleteInventoryById
);
router.get("/checkSite", InventoryController.checkSite);
router.post("/addSite", InventoryController.addSite);

module.exports = router;
