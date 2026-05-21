const express = require("express");
const router = express.Router();
const ItemController = require("./item-controller");

router.post("/create-item", ItemController.createItem);
router.post("/create-multiple-items", ItemController.createMultipleItems);
router.get("/get-items", ItemController.getAllItems);
router.get("/search", ItemController.searchItems);
router.get("/get-items-by-id/:itemId", ItemController.getItemById);
router.post("/update-item/:itemId", ItemController.updateItemById);
router.delete("/delete-item/:itemId", ItemController.deleteItemById);

module.exports = router;
