const VendorPayment = require("./vendor-payment-model");
const { RFQModel } = require("../rfq/rfqModal");
const { PoModel } = require("../purchasing-order/poModal");

// Create a new vendor payment request
exports.createPaymentRequest = async (req, res) => {
  try {
    const {
      vendor,
      po,
      amount,
      attachment,
      remarks,
      requestedBy,
      serviceRequestId,
      billId,
    } = req.body;
    const paymentData = {
      vendor,
      billId,
      amount,
      attachment,
      remarks,
      requestedBy,
      serviceRequestId,
    };

    // Only include po if it's provided (not null/undefined)
    if (po) {
      paymentData.po = po;
    }

    const payment = new VendorPayment(paymentData);
    await payment.save();
    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all vendor payment requests
exports.getAllPaymentRequests = async (req, res) => {
  try {
    const payments = await VendorPayment.find()
      .populate("vendor")
      .populate({
        path: "billId",
        populate: { path: "service_request" },
      })
      .populate({
        path: "po",
        populate: {
          path: "rfqId",
          populate: { path: "serviceRequestId" },
        },
      })
      .populate("requestedBy")
      .populate("approved_by")
      .populate("mark_as_paid_by");
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get a single payment request by ID
exports.getPaymentRequestById = async (req, res) => {
  try {
    const { po, billId } = req.query;
    const id = req.params.id;

    let query = {};

    // If searching by PO
    if (po) {
      query.po = po;
    }
    // If searching by Bill ID
    else if (billId) {
      query.billId = billId;
    }
    // If searching by payment ID directly
    else if (id) {
      query._id = id;
    } else {
      return res
        .status(400)
        .json({ error: "Please provide po, billId, or id parameter" });
    }

    const payment = await VendorPayment.find(query)
      .populate("vendor")
      .populate({
        path: "billId",
        populate: { path: "service_request" },
      })
      .populate({
        path: "po",
        populate: {
          path: "rfqId",
          populate: { path: "serviceRequestId" },
        },
      })
      .populate("requestedBy")
      .populate("approved_by")
      .populate("mark_as_paid_by");

    if (!payment || payment.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    res.json({ data: payment });
  } catch (err) {
    console.error("Error fetching payment:", err);
    res.status(500).json({ error: err.message });
  }
};

// Update payment status
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const payment = await VendorPayment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!payment) return res.status(404).json({ error: "Not found" });
    res.json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Update vendor payment status (approve, reject, paid)
exports.updateVendorPaymentStatus = async (req, res) => {
  try {
    const {
      status,
      approved_by,
      approved_date,
      mark_as_paid_by,
      approved_amount,
      remarks,
      mark_as_paid_date,
    } = req.body;
    const validStatuses = [
      "Submitted",
      "Requested",
      "Approved",
      "Rejected",
      "Paid",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const updatedPayment = await VendorPayment.findByIdAndUpdate(
      req.params.id,
      {
        status,
        approved_by,
        approved_date,
        mark_as_paid_by,
        approved_amount,
        remarks,
        mark_as_paid_date,
      },
      { new: true }
    );
    if (!updatedPayment)
      return res.status(404).json({ message: "Vendor Payment not found" });
    res.json({ message: "Status Updated Successfully" });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Error Updating status", error: error.message });
  }
};

// Get vendor payments by service request ID
exports.getPaymentsByServiceRequestId = async (req, res) => {
  try {
    const { id } = req.params;

    const payments = await VendorPayment.find({ serviceRequestId: id })
      .populate("vendor")
      .populate({
        path: "billId",
        populate: { path: "service_request" },
      })
      .populate({
        path: "po",
        populate: {
          path: "rfqId",
          populate: { path: "serviceRequestId" },
        },
      })
      .populate("requestedBy")
      .populate("approved_by")
      .populate("mark_as_paid_by");

    if (!payments || payments.length === 0) {
      return res.status(404).json({
        message: "No vendor payments found for this service request",
      });
    }

    res.json(payments);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching vendor payments",
      error: error.message,
    });
  }
};

// Update vendor payment request
exports.updatePaymentRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      vendor,
      billId,
      po,
      amount,
      approved_amount,
      attachment,
      remarks,
      status,
      serviceRequestId,
      approved_by,
      approved_date,
      mark_as_paid_by,
      mark_as_paid_date,
    } = req.body;

    const updateData = {};

    // Only include fields that are provided
    if (vendor !== undefined) updateData.vendor = vendor;
    if (billId !== undefined) updateData.billId = billId;
    if (po !== undefined) updateData.po = po;
    if (amount !== undefined) updateData.amount = amount;
    if (approved_amount !== undefined)
      updateData.approved_amount = approved_amount;
    if (attachment !== undefined) updateData.attachment = attachment;
    if (remarks !== undefined) updateData.remarks = remarks;
    if (status !== undefined) updateData.status = status;
    if (serviceRequestId !== undefined)
      updateData.serviceRequestId = serviceRequestId;
    if (approved_by !== undefined) updateData.approved_by = approved_by;
    if (approved_date !== undefined) updateData.approved_date = approved_date;
    if (mark_as_paid_by !== undefined)
      updateData.mark_as_paid_by = mark_as_paid_by;
    if (mark_as_paid_date !== undefined)
      updateData.mark_as_paid_date = mark_as_paid_date;

    const updatedPayment = await VendorPayment.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("vendor")
      .populate({
        path: "billId",
        populate: { path: "service_request" },
      })
      .populate({
        path: "po",
        populate: {
          path: "rfqId",
          populate: { path: "serviceRequestId" },
        },
      })
      .populate("requestedBy")
      .populate("approved_by")
      .populate("mark_as_paid_by");

    if (!updatedPayment) {
      return res.status(404).json({
        message: "Vendor payment request not found",
      });
    }

    // If serviceRequestId is provided, update related PO and RFQ records
    if (serviceRequestId !== undefined && updatedPayment.po) {
      try {
        // Update the PO record with serviceRequestId if it exists
        const poId = updatedPayment.po._id || updatedPayment.po;
        await PoModel.findByIdAndUpdate(poId, {
          serviceRequestId: serviceRequestId,
        });

        // Get the PO to find the related RFQ
        const updatedPo = await PoModel.findById(poId).populate("rfqId");

        if (updatedPo && updatedPo.rfqId) {
          // Update the RFQ record with serviceRequestId
          await RFQModel.findByIdAndUpdate(updatedPo.rfqId._id, {
            serviceRequestId: serviceRequestId,
          });
        }
      } catch (updateError) {
        console.error("Error updating PO and RFQ records:", updateError);
        // Don't fail the main request if PO/RFQ update fails
      }
    }

    res.json({
      message: "Vendor payment request updated successfully",
      data: updatedPayment,
    });
  } catch (error) {
    res.status(400).json({
      message: "Error updating vendor payment request",
      error: error.message,
    });
  }
};

// Delete vendor payment request
exports.deletePaymentRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedPayment = await VendorPayment.findByIdAndDelete(id);

    if (!deletedPayment) {
      return res.status(404).json({
        message: "Vendor payment request not found",
      });
    }

    res.json({
      message: "Vendor payment request deleted successfully",
      data: deletedPayment,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting vendor payment request",
      error: error.message,
    });
  }
};
