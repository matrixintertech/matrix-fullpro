const express = require("express");
const {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
} = require("./supplier-controller");
const router = express.Router();

router.post("/create-supplier", createSupplier);
router.get("/get-all-supplier", getAllSuppliers);
router.get("/get-supplier-by-id/:id", getSupplierById);
router.post("/update-supplier/:id", updateSupplier);
router.delete("/delete-supplier/:id", deleteSupplier);

module.exports = router;
