const express = require("express");
const router = express.Router();
const {
  createPO,
  getAllPOs,
  getPOById,
  updatePO,
  deletePO,
  getPOsByVendor,
  getPOByRFQId,
  checkPOExists,
  checkLastPO,
} = require("./poController");

// Purchase Order routes
router.post("/create-po", createPO);
router.get("/get-all-po", getAllPOs);
router.get("/get-po-by-id/:id", getPOById);
router.put("/update-po/:id", updatePO);
router.delete("/delete-po/:id", deletePO);
router.get("/vendor/:vendorId", getPOsByVendor);
router.get("/rfq/:rfqId", getPOByRFQId);
router.post("/checkpo", checkPOExists);
router.get("/checkLastPo", checkLastPO);

module.exports = router;
