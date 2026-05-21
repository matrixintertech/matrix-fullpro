const { PaymentModel, Status } = require("./payment-model");

// Create a new payment
async function createPayment(req, res) {
  const payment = new PaymentModel(req.body);
  try {
    const savedPayment = await payment.save();
    res.status(201).json({ message: "Payment Created Successfully" });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Error Creating Payment", error: error.message });
  }
}

async function getPaymentByServiceId(req, res) {
  try {
    const payments = await PaymentModel.find({
      serviceRequestId: req.params.serviceId,
    })
      .populate([
        {
          path: "serviceRequestId",
          populate: {
            path: "users",
            model: "User",
          },
        },
        "user_id",
        "approved_by",
        "mark_as_paid_by",
      ])
      .sort({ createdAt: -1 });

    res.json(payments);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error Getting Payments", error: error.message });
  }
}
async function getPaymentsByQuery(req, res) {
  try {
    // Combine query parameters and body data, giving priority to body data
    const searchCriteria = { ...req.query, ...req.body };

    const payments = await PaymentModel.find(searchCriteria)
      .populate([
        {
          path: "serviceRequestId",
          populate: {
            path: "users",
            model: "User",
          },
        },
        "user_id",
        "approved_by",
        "mark_as_paid_by",
      ])
      .sort({ createdAt: -1 });

    res.json(payments);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error Getting Payments", error: error.message });
  }
}

// Update payment status
async function updatePaymentStatus(req, res) {
  try {
    const {
      paymentStatus,
      approved_by,
      approved_date,
      approved_amount,
      remark,
      mark_as_paid_date,
      mark_as_paid_by,
      paymentsRemarks,
    } = req.body;
    // Validate paymentStatus against Status constants
    if (!Object.values(Status).includes(paymentStatus)) {
      return res.status(400).json({ message: "Invalid payment status" });
    }
    const updatedPayment = await PaymentModel.findByIdAndUpdate(
      req.params.id,
      {
        paymentStatus,
        approved_by,
        approved_date,
        approved_amount,
        remark,
        mark_as_paid_date,
        mark_as_paid_by,
        paymentsRemarks,
      },
      { new: true }
    );
    if (!updatedPayment)
      return res.status(404).json({ message: "Payment not found" });
    res.json({ message: "Status Updated Successfully" });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Error Updating status", error: error.message });
  }
}

const deletePayments = async (req, res) => {
  try {
    const deletedPayment = await PaymentModel.findByIdAndDelete(req.params.id);
    if (!deletedPayment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    res.json({ message: "Payment deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting payment", error: error.message });
  }
};

module.exports = {
  createPayment,
  getPaymentByServiceId,
  getPaymentsByQuery,
  updatePaymentStatus,
  deletePayments,
};
