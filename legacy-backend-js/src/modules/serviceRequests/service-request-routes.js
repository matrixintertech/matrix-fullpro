const express = require("express");
const router = express.Router();
const uploadImage = require("./upload");
const {
  createRequest,
  getAllRequests,
  getRequestById,
  assignPm,
  assignSm,
  addOrUpdateQuotationForRequest,
  addAfterImagesForRequest,
  getServiceRequestDetails,
  updateQuotationApprovalStatus,
  getServiceRequestsByServicePartnerId,
  getServiceRequestsByClientId,
  assignToUser,
  addBeforeImagesForRequest,
  getServiceRequestsByUserHierarchy,
  deleteAfterImageForRequest,
  deleteBeforeImageForRequest,
  addTeamMembers,
  updateServiceTargetStatus,
  editServiceRequest,
  deleteServiceRequest,
} = require("./service-request-controller");

router.post("/create-Request", createRequest);
router.get("/get-all-request", getAllRequests);
router.get("/get-request-by-Id/:id", getRequestById);
router.put("/edit-request/:id", editServiceRequest);
router.delete("/delete-request/:id", deleteServiceRequest);
router.post("/assign-pm/:id", assignPm);
router.post("/add-team-members/:id", addTeamMembers);
router.post("/assign-sm/:id", assignSm);
router.post("/assign-to-user/:id", assignToUser);
router.post("/quotation-status/:id", updateQuotationApprovalStatus);
router.post("/service-target-status/:id", updateServiceTargetStatus);
router.get("/get-service-details/:serviceRequestId", getServiceRequestDetails);
router.post("/quotation/:id", addOrUpdateQuotationForRequest);
router.post("/after-images/:id", addAfterImagesForRequest);
router.post("/before-images/:id", addBeforeImagesForRequest);
router.delete("/after-images/:id", deleteAfterImageForRequest);
router.delete("/before-images/:id", deleteBeforeImageForRequest);
router.get(
  "/get-by-service-partner-id/:servicePartnerId",
  getServiceRequestsByServicePartnerId
);
router.get("/get-by-client-id/:clientId", getServiceRequestsByClientId);
router.get(
  "/service-requests-by-user-hierarchy",
  getServiceRequestsByUserHierarchy
);

router.post("/uploadImage", uploadImage);

module.exports = router;
