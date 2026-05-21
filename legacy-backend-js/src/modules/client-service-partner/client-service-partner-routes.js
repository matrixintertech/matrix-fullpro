const express = require("express");
const router = express.Router();

const {
  createClientServicePartner,
  getAllClientServicePartners,
  getClientServicePartnerById,
  updateClientServicePartner,
  deleteClientServicePartner,
  getAllClientServicePartnersByQuery,
} = require("./client-service-partner-controller");

router.post("/create-client-service-partner", createClientServicePartner);
router.get("/get-all-client-service-partner", getAllClientServicePartners);
router.get(
  "/get-client-service-partner-by-query",
  getAllClientServicePartnersByQuery
);
router.get(
  "/get-client-service-partner-by-id/:id",
  getClientServicePartnerById
);
router.post("/update-client-service-partner/:id", updateClientServicePartner);
router.delete("/delete-client-service-partner/:id", deleteClientServicePartner);

module.exports = router;
