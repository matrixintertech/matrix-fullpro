const express = require("express");
const {
  createInventoryRequest,
  getAllInventoryRequests,
  getInventoryRequestById,
  updateInventoryRequest,
  deleteInventoryRequest,
} = require("./inventory-request-controller");
const router = express.Router();

router.post("/create-inventory-request", createInventoryRequest);
router.get("/get-all-inventory-request", getAllInventoryRequests);
router.get("/get-inventory-request-by-id/:id", getInventoryRequestById);
router.post("/update-inventory-request/:id", updateInventoryRequest);
router.delete("/delete-inventory-request/:id", deleteInventoryRequest);

module.exports = router;
