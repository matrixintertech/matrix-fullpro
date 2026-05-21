const express = require("express");
const router = express.Router();

const {
  createVendor,
  getAllVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  getVendorAndClientVendorById,
  getVendorWithServicePartnerIdWithoutAdmin,
  getVendorsBasedOnDealingIn,
  getVendorsBasedOnType,
  getVendorsExcludingTypes,
  getVendorsByLegalStatus,
} = require("./vendor-controller");

router.post("/create-vendor", createVendor);
router.get("/get-all-vendors", getAllVendors);
router.get("/get-vendor-by-id/:id", getVendorById);
router.post("/update-vendor/:id", updateVendor);
router.post("/get-vendors-based-on-dealing-in", getVendorsBasedOnDealingIn);
router.post("/get-vendors-based-on-type", getVendorsBasedOnType);
router.post("/get-vendors-by-legal-status", getVendorsByLegalStatus);
router.post("/get-vendors-excluding-types", getVendorsExcludingTypes);
router.delete("/delete-vendor/:id", deleteVendor);
router.get("/get-vendor/:id", getVendorAndClientVendorById);
router.get(
  "/get-vendors-with-service-partner-id-without-admin/:id",
  getVendorWithServicePartnerIdWithoutAdmin
);

module.exports = router;
