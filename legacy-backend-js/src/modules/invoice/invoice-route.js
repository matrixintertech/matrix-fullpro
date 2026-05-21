const express = require("express");
const router = express.Router();
const invoiceController = require("./invoice-controller");

// Create Invoice
router.post("/create-invoice", invoiceController.createInvoice);

// Get all Invoices
router.get("/getAllInvoice", invoiceController.getAllInvoices);

// Get Invoice by ID
router.get("/getInvoiceById/:id", invoiceController.getInvoiceById);

// Get Invoice by poId and vendorId
router.get("/findByPoAndVendor", invoiceController.getInvoiceByPoAndVendor);

// Get Invoice by poId and vendorId
router.get(
  "/findInvoiceByInvoiceData",
  invoiceController.findInvoiceByInvoiceData
);

//send mail
router.post("/sendMail", invoiceController.sendInvoiceMail);
router.post("/updateInvoiceApproval", invoiceController.updateInvoiceApproval);

// Update Invoice
router.put("/updateInvoice/:id", invoiceController.updateInvoice);
router.post(
  "/attach-invoice-attachment/:invoiceId/:invoiceDetailId",
  invoiceController.attachInvoiceAttachment
);

// Delete Invoice
router.delete("/deleteInvoice", invoiceController.deleteInvoice);

// Get Invoice by RFQ ID
router.get("/getInvoiceByPo/:poId", invoiceController.getInvoiceByPo);

// Get Invoices by Vendor ID
router.get(
  "/getInvoiceByVendor/:vendorId",
  invoiceController.getInvoiceByVendor
);

// Get Invoices by RFQ ID
router.get("/getInvoiceByRfqId/:rfqId", invoiceController.getInvoiceByRfqId);

module.exports = router;
