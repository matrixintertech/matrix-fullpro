const express = require("express");
const router = express.Router();
const {
  createRFQ,
  getAllRFQs,
  getRFQById,
  updateRFQ,
  deleteRFQ,
  getRFQsByServicePartner,
  getRFQsByUser,
  getRFQsByCategory,
  getRFQsByVendorId,
  getRFQsByServiceRequestId,
  submitQuotation,
  getQuotationsByRfqId,
  handleQuotationResponse,
  getQuotationDetails,
  getAllQuotations,
  approveRFQ,
  updateRFQByVendorId,
  deleteQuotationByVendorId,
} = require("./rfqController");

// RFQ routes
router.post("/create-rfq", createRFQ);
router.get("/get-all-rfq", getAllRFQs);
router.get("/get-all-quotation-from-rfq", getAllQuotations);
router.get("/get-rfq-by-id", getRFQById);
router.post("/update-rfq/:id", updateRFQ);
router.put("/update-rfq/:rfqId/vendor/:vendorId", updateRFQByVendorId);
router.delete(
  "/delete-rfq-by-vendorId/:rfqId/vendor/:vendorId",
  deleteQuotationByVendorId
);
router.delete("/delete-rfq/:id", deleteRFQ);
router.get(
  "/get-rfq-by-service-partner/:servicePartnerId",
  getRFQsByServicePartner
);
router.get(
  "/get-rfq-by-service-request/:serviceRequestId",
  getRFQsByServiceRequestId
);
router.get("/get-rfq-by-user/:userId", getRFQsByUser);
router.get("/get-rfq-by-category/:category", getRFQsByCategory);
router.get("/get-rfq-by-vendor/:vendorId", getRFQsByVendorId);
router.post("/submit-quotation/:rfqId/:vendorId", submitQuotation);
router.get("/quotations/:rfqId", getQuotationsByRfqId);
router.post("/quotation-response/:rfqId/:vendorId", handleQuotationResponse);
router.get("/quotation-details/:rfqId/:vendorId", getQuotationDetails);
router.post("/approve-rfq/:rfqId", approveRFQ);

module.exports = router;
