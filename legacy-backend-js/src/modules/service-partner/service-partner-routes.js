const express = require("express");
const router = express.Router();
const {
  createServicePartner,
  getAllServicePartners,
  updateServicePartner,
  deleteServicePartner,
  getServicePartnerById,
} = require("./service-partner-controller");

router.post("/create-service-partner", createServicePartner);

router.get("/get-All-service-partner", getAllServicePartners);
router.get("/get-service-partner-by-id/:id", getServicePartnerById);

router.post("/update-service-partner/:id", updateServicePartner);

router.delete("/delete-service-partner/:id", deleteServicePartner);

module.exports = router;
