const express = require("express");
const router = express.Router();
const controller = require("./purchase-order-controller");

router.post("/create-purchase-order", controller.createPurchaseOrder);
router.get("/get-all-po", controller.getAllPurchaseOrders);
router.get("/:id", controller.getPurchaseOrderById);
router.put("/:id", controller.updatePurchaseOrder);
router.delete("/:id", controller.deletePurchaseOrder);
// Approve or Reject Purchase Order
router.post("/update-status/:id", controller.updatePurchaseOrderStatus);
// Get all Purchase Orders by servicePartnerId
router.get(
  "/by-service-partner/:servicePartnerId",
  controller.getPurchaseOrdersByServicePartnerId
);

module.exports = router;
