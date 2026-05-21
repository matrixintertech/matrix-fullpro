const express = require("express");
const router = express.Router();
const QuotationController = require("./quotation-controller");

router.get(
  "/quotations/service/:serviceRequestId",
  QuotationController.getQuotationByServiceId
);

router.put(
  "/quotations/service/:serviceRequestId",
  QuotationController.updateQuotationByServiceId
);

router.post("/create-quotations", QuotationController.createQuotation);
router.get("/quotations", QuotationController.getAllQuotations);
router.get("/get-quotations/:id", QuotationController.getQuotationById);
router.get("/get-tasks/:id", QuotationController.getTasks);
router.post("/update-quotation/:id", QuotationController.updateQuotation);
router.post("/update-items/:serviceId", QuotationController.updateItemDetails);
router.delete("/quotations/:id", QuotationController.deleteQuotation);
router.post(
  "/quotation/:quotationId/item",
  QuotationController.updateQuotationItemStatus
);
router.get(
  "/quotation/items/:serviceRequestId",
  QuotationController.getAllQuotationItemsByServiceId
);

module.exports = router;
