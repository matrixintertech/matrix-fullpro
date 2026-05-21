const { InvoiceModel } = require("./invoice-modal");
const { sendEmail } = require("../../utils/helpers");

// Create Invoice
exports.createInvoice = async (req, res) => {
  try {
    const { poId, vendorId, rfqId, invoiceData, isApproved } = req.body;
    // console.log(poId);
    let invoice = await InvoiceModel.findOne({ poId, vendorId: vendorId });
    if (invoice) {
      // Calculate and add totalAmount for each new invoiceData entry
      if (Array.isArray(invoiceData)) {
        invoiceData.forEach((inv) => {
          if (Array.isArray(inv.items)) {
            inv.totalAmount = inv.items.reduce((sum, item) => {
              return sum + (item.quantity || 0) * (item.price || 0);
            }, 0);
          } else {
            inv.totalAmount = 0;
          }
          // Apply isApproved if provided
          if (isApproved !== undefined) {
            inv.isApproved = isApproved;
          }
        });
      }
      // Append new invoiceData
      invoice.invoiceData.push(...invoiceData);
      // Update invoiceCount
      invoice.invoiceCount = invoice.invoiceData.length;
      // Set isInvoiceGenerated true
      invoice.isInvoiceGenerated = true;
      // Get last invoiceData array
      const lastInvoiceData =
        invoice.invoiceData[invoice.invoiceData.length - 1];
      // Calculate totals from last invoiceData's items
      let usedQuantity = 0,
        consumedPrice = 0,
        actualQuantity = 0,
        actulPrice = 0,
        totalAmount = 0;
      if (lastInvoiceData && Array.isArray(lastInvoiceData.items)) {
        lastInvoiceData.items.forEach((item) => {
          usedQuantity += item.usedQuantity || 0;
          consumedPrice += item.consumedPrice || 0;
          actualQuantity += item.quantity || 0;
          actulPrice += item.price || 0;
          totalAmount += (item.quantity || 0) * (item.price || 0);
        });
      }
      invoice.usedQuantity = usedQuantity;
      invoice.consumedPrice = consumedPrice;
      invoice.actualQuantity = actualQuantity;
      invoice.actulPrice = actulPrice;
      invoice.totalAmount = totalAmount;
      await invoice.save();
      res.status(200).json(invoice);
    } else {
      // Calculate and add totalAmount for each invoiceData entry
      let invoiceDataArr = Array.isArray(req.body.invoiceData)
        ? req.body.invoiceData
        : [];
      invoiceDataArr.forEach((inv) => {
        if (Array.isArray(inv.items)) {
          inv.totalAmount = inv.items.reduce((sum, item) => {
            return sum + (item.quantity || 0) * (item.price || 0);
          }, 0);
        } else {
          inv.totalAmount = 0;
        }
        // Apply isApproved if provided
        if (isApproved !== undefined) {
          inv.isApproved = isApproved;
        }
      });
      // New invoice
      let newInvoice = new InvoiceModel({
        poId: poId,
        vendorId: vendorId,
        rfqId: rfqId,
        invoiceData: invoiceDataArr,
        invoiceCount:
          (req.body.invoiceData && req.body.invoiceData.length) || 1,
        isInvoiceGenerated: true,
      });
      // Get last invoiceData array
      const lastInvoiceData =
        req.body.invoiceData &&
        req.body.invoiceData[req.body.invoiceData.length - 1];
      let usedQuantity = 0,
        consumedPrice = 0,
        actualQuantity = 0,
        actulPrice = 0,
        totalAmount = 0;
      if (lastInvoiceData && Array.isArray(lastInvoiceData.items)) {
        lastInvoiceData.items.forEach((item) => {
          usedQuantity += item.usedQuantity || 0;
          consumedPrice += item.consumedPrice || 0;
          actualQuantity += item.quantity || 0;
          actulPrice += item.price || 0;
          totalAmount += (item.quantity || 0) * (item.price || 0);
        });
      }
      newInvoice.usedQuantity = usedQuantity;
      newInvoice.consumedPrice = consumedPrice;
      newInvoice.actualQuantity = actualQuantity;
      newInvoice.actulPrice = actulPrice;
      newInvoice.totalAmount = totalAmount;
      await newInvoice.save();
      res.status(201).json(newInvoice);
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all Invoices
exports.getAllInvoices = async (req, res) => {
  try {
    const invoices = await InvoiceModel.find()
      .populate({
        path: "poId",
        populate: [
          { path: "rfqId" },
          { path: "vednorId" }, // Note: PO model uses vednorId (typo)
        ],
      })
      .populate("vendorId");

    // If vendorId is null, use vendorId from PO
    const invoicesWithVendor = invoices.map((invoice) => {
      const invoiceObj = invoice.toObject();
      if (!invoiceObj.vendorId && invoiceObj.poId && invoiceObj.poId.vednorId) {
        invoiceObj.vendorId = invoiceObj.poId.vednorId;
      }
      return invoiceObj;
    });

    res.json(invoicesWithVendor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Invoice by poId and vendorId
exports.getInvoiceByPoAndVendor = async (req, res) => {
  try {
    const { poId, vendorId } = req.query;
    if (!poId || !vendorId) {
      return res
        .status(400)
        .json({ error: "Both poId and vendorId are required" });
    }
    const invoice = await InvoiceModel.findOne({ poId, vendorId: vendorId })
      .populate({
        path: "poId",
        populate: [
          { path: "rfqId" },
          { path: "vednorId" }, // Note: PO model uses vednorId (typo)
        ],
      })
      .populate("vendorId", "rfqId");
    if (!invoice) {
      return res
        .status(404)
        .json({ error: "Invoice not found for given poId and vendorId" });
    }

    // If vendorId is null, use vendorId from PO
    const invoiceObj = invoice.toObject();
    if (!invoiceObj.vendorId && invoiceObj.poId && invoiceObj.poId.vednorId) {
      invoiceObj.vendorId = invoiceObj.poId.vednorId;
    }

    res.json(invoiceObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Invoice by ID
exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await InvoiceModel.findById(req.params.id)
      .populate({
        path: "poId",
        populate: [
          { path: "rfqId" },
          { path: "vednorId" }, // Note: PO model uses vednorId (typo)
        ],
      })
      .populate("vendorId");

    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    // If vendorId is null, use vendorId from PO
    const invoiceObj = invoice.toObject();
    if (!invoiceObj.vendorId && invoiceObj.poId && invoiceObj.poId.vednorId) {
      invoiceObj.vendorId = invoiceObj.poId.vednorId;
    }

    res.json(invoiceObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Invoice
exports.updateInvoice = async (req, res) => {
  try {
    const { id } = req.params; // This is the invoiceId
    const { invoiceDataId, items, vendorId, poId, rfqId } = req.body;

    // Find the invoice document
    const invoice = await InvoiceModel.findById(id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Update vendorId if provided
    if (vendorId) {
      invoice.vendorId = vendorId;
    }

    // Update poId if provided
    if (poId) {
      invoice.poId = poId;
    }

    // Update rfqId if provided
    if (rfqId) {
      invoice.rfqId = rfqId;
    }

    // Find the specific invoiceData item to update
    const invoiceDataItem = invoice.invoiceData.id(invoiceDataId);
    if (!invoiceDataItem) {
      return res.status(404).json({ error: "Invoice data not found" });
    }

    // Update the items in the invoiceData
    if (items && Array.isArray(items)) {
      invoiceDataItem.items = items;
    }

    // Save the updated invoice
    const updatedInvoice = await invoice.save();

    res.json({
      message: "Invoice updated successfully",
      invoice: updatedInvoice,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete Invoice
exports.deleteInvoice = async (req, res) => {
  try {
    const invoiceId = req.query.invoiceId;
    const invoiceDetailId = req.query.invoiceDetailId;

    if (!invoiceId || !invoiceDetailId) {
      return res.status(400).json({
        error: "Both invoiceId and invoiceDetailId are required",
      });
    }

    // Find the invoice document
    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Remove the specific invoiceData item
    const invoiceDataItem = invoice.invoiceData.id(invoiceDetailId);
    if (!invoiceDataItem) {
      return res.status(404).json({ error: "Invoice detail not found" });
    }

    invoiceDataItem.deleteOne();

    // If no invoiceData items left, you might want to delete the entire invoice
    if (invoice.invoiceData.length === 1) {
      // Will be 0 after save
      await InvoiceModel.findByIdAndDelete(invoiceId);
      return res.json({ message: "Invoice deleted completely" });
    }

    // Save the updated invoice
    await invoice.save();

    res.json({ message: "Invoice data deleted successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.sendInvoiceMail = async (req, res) => {
  try {
    const { user, invoiceData } = req.body;
    // Send Email
    sendEmail({
      //   recipientEmail: user?.email,
      recipientEmail: "mauryagourav82@gmail.com",
      ccEmails: ["mi2005.delhi@gmail.com", "Erp.user@matrixonline.in"],
      subject: `Invoice From ${user?.companyName || "Vendor"}`,
      body: `Invoice Details:\n${formatInvoiceData(invoiceData)}`,
    });
    res.status(200).json({ message: "Email sent successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

function formatInvoiceData(invoice) {
  let poNumber = invoice.poId?.poNumber || "";
  let rfqTitle = invoice.poId?.rfqId?.title || "";
  // Use vendorId from invoice, or fallback to PO's vednorId
  let vendorId = invoice.vendorId?._id || invoice.poId?.vednorId?._id || "";
  let invoiceCount = invoice.invoiceCount || 0;
  let totalAmount = invoice.totalAmount || 0;

  let invoiceDetails = invoice.invoiceData
    .map((inv, idx) => {
      let items = (inv.items || [])
        .map(
          (item, i) =>
            `      ${i + 1}. Item: ${item.name || ""}, Qty: ${
              item.quantity || 0
            }, Price: ${item.price || 0}, Used Qty: ${
              item.usedQuantity || 0
            }, Consumed Price: ${item.consumedPrice || 0}`
        )
        .join("\n");
      return `
    Invoice #${idx + 1}:
      Date: ${new Date(inv.date).toLocaleString()}
      Status: - ${inv.isApproved}
      Paid - ${inv.isPaid}
      Items:
${items}
      Invoice ID: ${inv._id}
    `;
    })
    .join("\n");

  return `
PO Number: ${poNumber}
RFQ Title: ${rfqTitle}
Vendor ID: ${vendorId}
Invoice Count: ${invoiceCount}
Total Amount: ${totalAmount}

Invoices:
${invoiceDetails}
  `;
}

exports.findInvoiceByInvoiceData = async (req, res) => {
  try {
    const { invoiceId, invoiceDetailId } = req.query;
    if (!invoiceId || !invoiceDetailId) {
      return res
        .status(400)
        .json({ error: "Both invoiceId and invoiceDetailId are required" });
    }
    // Find invoice by _id
    const invoice = await InvoiceModel.findById(invoiceId)
      .populate({
        path: "poId",
        populate: [
          { path: "rfqId" },
          { path: "vednorId" }, // Note: PO model uses vednorId (typo)
        ],
      })
      .populate("vendorId");
    if (!invoice) {
      return res
        .status(404)
        .json({ error: "Invoice not found for given invoiceId" });
    }
    // Find the specific invoiceData entry
    const invoiceDetail = invoice.invoiceData.id(invoiceDetailId);
    if (!invoiceDetail) {
      return res
        .status(404)
        .json({ error: "Invoice detail not found for given invoiceDetailId" });
    }
    // Prepare response: all invoice fields except invoiceData, and add invoiceDetail
    const invoiceObj = invoice.toObject();
    delete invoiceObj.invoiceData;

    // If vendorId is null, use vendorId from PO
    if (!invoiceObj.vendorId && invoiceObj.poId && invoiceObj.poId.vednorId) {
      invoiceObj.vendorId = invoiceObj.poId.vednorId;
    }

    res.json({
      ...invoiceObj,
      invoiceDetail,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// Update isApproved status for a specific invoiceData entry
exports.updateInvoiceApproval = async (req, res) => {
  try {
    const { invoiceId, invoiceDataId, isApproved, approvalDate } = req.body;
    if (!invoiceId || !invoiceDataId || !isApproved) {
      return res.status(400).json({ message: "Missing required fields." });
    }
    const update = {
      "invoiceData.$.isApproved": isApproved,
    };
    if (approvalDate) {
      update["invoiceData.$.approvalDate"] = approvalDate;
    }
    const result = await InvoiceModel.updateOne(
      { _id: invoiceId, "invoiceData._id": invoiceDataId },
      { $set: update }
    );
    if (result.nModified === 0) {
      return res
        .status(404)
        .json({ message: "Invoice or invoiceData not found." });
    }
    res.json({ message: "Invoice approval status updated successfully." });
  } catch (error) {
    res.status(500).json({
      message: "Error updating approval status",
      error: error.message,
    });
  }
};

// Attach Invoice Attachment
exports.attachInvoiceAttachment = async (req, res) => {
  try {
    const { invoiceId, invoiceDetailId } = req.params;
    const { attachment, user } = req.body; // user info should be sent in body

    const invoice = await InvoiceModel.findById(invoiceId)
      .populate({
        path: "poId",
        populate: [
          { path: "rfqId" },
          { path: "vednorId" }, // Note: PO model uses vednorId (typo)
        ],
      })
      .populate("vendorId");
    if (!invoice) {
      return res
        .status(404)
        .json({ success: false, message: "Invoice not found" });
    }

    const invoiceDetail = invoice.invoiceData.id(invoiceDetailId);
    if (!invoiceDetail) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid invoiceDetailId" });
    }

    invoiceDetail.attachment = attachment;
    await invoice.save();

    // If vendorId is null, use vendorId from PO for email formatting
    const invoiceObj = invoice.toObject();
    if (!invoiceObj.vendorId && invoiceObj.poId && invoiceObj.poId.vednorId) {
      invoiceObj.vendorId = invoiceObj.poId.vednorId;
    }

    // Send email after attaching
    await sendEmail({
      recipientEmail: "mauryagourav82@gmail.com",
      ccEmails: ["mi2005.delhi@gmail.com", "Erp.user@matrixonline.in"],
      subject: `Invoice From ${user?.companyName || "Vendor"}`,
      body: `Invoice Details:\n${formatInvoiceData(invoiceObj)}`,
    });

    // Return invoice with vendorId populated from PO if needed
    const responseInvoice = invoice.toObject();
    if (
      !responseInvoice.vendorId &&
      responseInvoice.poId &&
      responseInvoice.poId.vednorId
    ) {
      responseInvoice.vendorId = responseInvoice.poId.vednorId;
    }

    res.json({
      success: true,
      message: "Attachment added and email sent",
      invoice: responseInvoice,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Attach Invoice Attachment Root
exports.attachInvoiceAttachmentRoot = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { attachment } = req.body; // Should be a URL or file path

    const invoice = await InvoiceModel.findByIdAndUpdate(
      invoiceId,
      { attachment },
      { new: true }
    );
    if (!invoice) {
      return res
        .status(404)
        .json({ success: false, message: "Invoice not found" });
    }
    res.json({ success: true, message: "Attachment added", invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Invoice by RFQ ID
exports.getInvoiceByPo = async (req, res) => {
  try {
    const { poId } = req.params;
    if (!poId) {
      return res.status(400).json({ error: "PO ID is required" });
    }

    const invoices = await InvoiceModel.find({ poId })
      .populate({
        path: "poId",
        populate: [
          { path: "rfqId" },
          { path: "vednorId" }, // Note: PO model uses vednorId (typo)
        ],
      })
      .populate("vendorId");

    if (!invoices || invoices.length === 0) {
      return res
        .status(404)
        .json({ error: "No invoices found for given PO ID" });
    }

    // If vendorId is null, use vendorId from PO
    const invoicesWithVendor = invoices.map((invoice) => {
      const invoiceObj = invoice.toObject();
      if (!invoiceObj.vendorId && invoiceObj.poId && invoiceObj.poId.vednorId) {
        invoiceObj.vendorId = invoiceObj.poId.vednorId;
      }
      return invoiceObj;
    });

    res.json(invoicesWithVendor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Invoices by Vendor ID
exports.getInvoiceByVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required",
      });
    }
    // console.log(vendorId, "vendorId");
    const invoices = await InvoiceModel.find({ vendorId: vendorId })
      .populate({
        path: "poId",
        populate: [
          {
            path: "rfqId",
            populate: {
              path: "serviceRequestId",
              populate: {
                path: "clientId",
              },
            },
          },
          { path: "vednorId" }, // Note: PO model uses vednorId (typo)
        ],
      })
      .populate(
        "vendorId",
        "companyName name email mobile address contact_name gst_number supplier_code type"
      )
      .sort({ createdAt: -1 });

    // If vendorId is null, use vendorId from PO
    const invoicesWithVendor = invoices.map((invoice) => {
      const invoiceObj = invoice.toObject();
      if (!invoiceObj.vendorId && invoiceObj.poId && invoiceObj.poId.vednorId) {
        invoiceObj.vendorId = invoiceObj.poId.vednorId;
      }
      return invoiceObj;
    });
    // console.log(invoices, "invoices");
    if (!invoices || invoices.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No invoices found for the given vendor",
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      count: invoicesWithVendor.length,
      message: "Invoices retrieved successfully",
      data: invoicesWithVendor,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching invoices by vendor",
      error: err.message,
    });
  }
};

// Get Invoices by RFQ ID
exports.getInvoiceByRfqId = async (req, res) => {
  try {
    const { rfqId } = req.params;

    if (!rfqId) {
      return res.status(400).json({
        success: false,
        message: "RFQ ID is required",
      });
    }

    const invoices = await InvoiceModel.find({ rfqId: rfqId })
      .populate({
        path: "poId",
        populate: [
          {
            path: "rfqId",
            populate: {
              path: "serviceRequestId",
              populate: {
                path: "clientId",
              },
            },
          },
          { path: "vednorId" }, // Note: PO model uses vednorId (typo)
        ],
      })
      .populate(
        "vendorId",
        "companyName name email mobile address contact_name gst_number supplier_code type"
      )
      .sort({ createdAt: -1 });

    if (!invoices || invoices.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No invoices found for the given RFQ",
        data: [],
      });
    }

    // If vendorId is null, use vendorId from PO
    const invoicesWithVendor = invoices.map((invoice) => {
      const invoiceObj = invoice.toObject();
      if (!invoiceObj.vendorId && invoiceObj.poId && invoiceObj.poId.vednorId) {
        invoiceObj.vendorId = invoiceObj.poId.vednorId;
      }
      return invoiceObj;
    });

    res.status(200).json({
      success: true,
      count: invoicesWithVendor.length,
      message: "Invoices retrieved successfully",
      data: invoicesWithVendor,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching invoices by RFQ",
      error: err.message,
    });
  }
};
