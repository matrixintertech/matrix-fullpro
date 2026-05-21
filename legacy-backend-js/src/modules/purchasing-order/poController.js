const { PoModel } = require("./poModal");
const { RFQModel } = require("../rfq/rfqModal"); // Add this import
const mongoose = require("mongoose");

// Create a new Purchase Order
async function createPO(req, res) {
  try {
    const {
      vendorId,
      rfqId,
      poNumber,
      billToAddress,
      billToGST,
      shipToAddress,
      shipToGST,
      quotation,
      createRFQAndPO,
      rfqData,
      serviceRequestId,
      isNewVendor,
      newVendorData,
    } = req.body;

    // Validate basic required fields
    if (!vendorId || !poNumber || !quotation) {
      return res.status(400).json({
        success: false,
        message: "vendorId, poNumber, and quotation are required",
      });
    }

    let finalRfqId = rfqId;

    // Scenario 2: Create new RFQ first if createRFQAndPO is true
    if (createRFQAndPO && !rfqId) {
      if (!rfqData || !serviceRequestId) {
        return res.status(400).json({
          success: false,
          message:
            "rfqData and serviceRequestId are required when creating new RFQ",
        });
      }
      // Create new RFQ
      const newRfq = new RFQModel({
        title: rfqData.title,
        category: rfqData.category,
        description: rfqData.description,
        type: rfqData.type,
        expectedDeadline: rfqData.expectedDeadline,
        items: rfqData.items,
        paymentTerms: rfqData.paymentTerms,
        freightExtra: rfqData.freightExtra,
        createdByservicePartnerUserId: rfqData.createdByservicePartnerUserId,
        servicePartnerId: rfqData.servicePartnerId,
        serviceRequestId: serviceRequestId,
        rfqNo: rfqData.rfqNo,
        assignedVendors: [
          {
            vendorId: vendorId,
            assignedDate: new Date(),
            status: "ACCEPTED",
            quotation: {
              amount: quotation.quotationData.amount,
              details: quotation.quotationData.details || "",
              items: quotation.quotationData.items,
              submittedAt: new Date(quotation.quotationData.submittedAt),
              vendorExpectedDeadline: new Date(
                quotation.quotationData.vendorExpectedDeadline
              ),
            },
          },
        ],
        status: "ACCEPTED",
      });

      const savedRfq = await newRfq.save();
      finalRfqId = savedRfq._id;
    }
    // Scenario 1: RFQ exists, handle existing or new vendor
    else if (rfqId) {
      const rfq = await RFQModel.findById(rfqId);
      if (!rfq) {
        return res.status(404).json({
          success: false,
          message: "RFQ not found",
        });
      }

      if (isNewVendor && newVendorData) {
        // Handle new vendor - reject all existing vendors and add new one
        rfq.assignedVendors.forEach((vendor) => {
          if (vendor.status === "RESPONDED" || vendor.status === "PENDING") {
            vendor.status = "REJECTED";
          }
        });

        // Add new vendor to assignedVendors
        rfq.assignedVendors.push({
          vendorId: newVendorData.vendorId,
          assignedDate: newVendorData.addedAt,
          status: "ACCEPTED",
          quotation: {
            amount: quotation.quotationData.amount,
            details: quotation.quotationData.details || "",
            items: quotation.quotationData.items,
            submittedAt: new Date(quotation.quotationData.submittedAt),
            vendorExpectedDeadline: new Date(
              quotation.quotationData.vendorExpectedDeadline
            ),
          },
        });
      } else {
        // Handle existing vendor
        const vendorIndex = rfq.assignedVendors.findIndex(
          (vendor) => vendor.vendorId.toString() === vendorId
        );

        if (vendorIndex === -1) {
          return res.status(404).json({
            success: false,
            message: "Vendor not found in assigned vendors for this RFQ",
          });
        }

        // Update the quotation data for the specific vendor
        rfq.assignedVendors[vendorIndex].quotation = {
          amount: quotation.quotationData.amount,
          details: quotation.quotationData.details || "",
          items: quotation.quotationData.items,
          submittedAt: new Date(quotation.quotationData.submittedAt),
          vendorExpectedDeadline: new Date(
            quotation.quotationData.vendorExpectedDeadline
          ),
        };

        // Update vendor statuses: ACCEPTED for selected vendor, REJECTED for others
        rfq.assignedVendors.forEach((vendor, index) => {
          if (index === vendorIndex) {
            vendor.status = "ACCEPTED";
          } else if (
            vendor.status === "RESPONDED" ||
            vendor.status === "PENDING"
          ) {
            vendor.status = "REJECTED";
          }
        });
      }

      // Save the updated RFQ
      await rfq.save();
    } else {
      return res.status(400).json({
        success: false,
        message: "Either rfqId must be provided or createRFQAndPO must be true",
      });
    }

    // Create Purchase Order
    const po = new PoModel({
      vednorId: vendorId,
      poNumber,
      rfqId: finalRfqId,
      billToAddress,
      billToGST,
      shipToAddress,
      shipToGST,
    });

    await po.save();

    // Update RFQ with the created PO ID
    await RFQModel.findByIdAndUpdate(
      finalRfqId,
      { poId: po._id },
      { new: true }
    );

    // Populate vendor details before sending response
    await po.populate("vednorId", "companyName email mobile");
    await po.populate({
      path: "rfqId",
      populate: {
        path: "serviceRequestId",
        populate: {
          path: "clientId",
        },
      },
    });

    // Calculate and update quotation amount if RFQ exists and has assigned vendors
    if (
      po.rfqId &&
      po.rfqId.assignedVendors &&
      po.rfqId.assignedVendors.length > 0
    ) {
      let rfqUpdated = false;

      for (let vendor of po.rfqId.assignedVendors) {
        if (
          vendor.status === "ACCEPTED" &&
          vendor.quotation &&
          vendor.quotation.items &&
          vendor.quotation.items.length > 0
        ) {
          let totalAmount = 0;

          // Calculate amount for each item with GST
          for (let item of vendor.quotation.items) {
            const quantity = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.price) || 0;
            const gstPercentage = parseFloat(item.gstPercentage) || 0;

            // Calculate current amount (quantity * price)
            const currentAmount = quantity * price;

            // Calculate GST amount
            const gstAmount = (gstPercentage / 100) * currentAmount;

            // Calculate amount with GST
            const amountWithGst = currentAmount + gstAmount;

            // Add to total amount
            totalAmount += amountWithGst;
          }

          // Round to 2 decimal places
          totalAmount = Math.round(totalAmount * 100) / 100;

          // Compare with existing quotation amount and update if different
          const existingAmount = parseFloat(vendor.quotation.amount) || 0;
          if (Math.abs(totalAmount - existingAmount) > 0.01) {
            vendor.quotation.amount = totalAmount;
            rfqUpdated = true;
          }
        }
      }

      // Save RFQ if any quotation amount was updated
      if (rfqUpdated) {
        await po.rfqId.save();
      }
    }

    res.status(201).json({
      success: true,
      message: "Purchase Order created successfully and quotation saved to RFQ",
      data: po,
    });
  } catch (error) {
    console.log(error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "PO number already exists",
      });
    }
    res.status(500).json({
      success: false,
      message: "Error creating Purchase Order",
      error: error.message,
    });
  }
}

// Get all Purchase Orders
async function getAllPOs(req, res) {
  try {
    const pos = await PoModel.find()
      .populate("vednorId")
      .populate({
        path: "rfqId",
        populate: {
          path: "serviceRequestId",
          populate: {
            path: "clientId",
          },
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: pos.length,
      data: pos,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching Purchase Orders",
      error: error.message,
    });
  }
}

// Get Purchase Order by ID
async function getPOById(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid PO ID",
      });
    }

    const po = await PoModel.findById(id)
      .populate("vednorId")
      .populate({
        path: "rfqId",
        populate: {
          path: "serviceRequestId",
          populate: {
            path: "clientId",
          },
        },
      });

    if (!po) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    // Calculate and update quotation amount if RFQ exists and has assigned vendors
    if (
      po.rfqId &&
      po.rfqId.assignedVendors &&
      po.rfqId.assignedVendors.length > 0
    ) {
      let rfqUpdated = false;

      for (let vendor of po.rfqId.assignedVendors) {
        if (
          vendor.status === "ACCEPTED" &&
          vendor.quotation &&
          vendor.quotation.items &&
          vendor.quotation.items.length > 0
        ) {
          let totalAmount = 0;

          // Calculate amount for each item with GST
          for (let item of vendor.quotation.items) {
            const quantity = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.price) || 0;
            const gstPercentage = parseFloat(item.gstPercentage) || 0;

            // Calculate current amount (quantity * price)
            const currentAmount = quantity * price;

            // Calculate GST amount
            const gstAmount = (gstPercentage / 100) * currentAmount;

            // Calculate amount with GST
            const amountWithGst = currentAmount + gstAmount;

            // Add to total amount
            totalAmount += amountWithGst;
          }

          // Round to 2 decimal places
          totalAmount = Math.round(totalAmount * 100) / 100;

          // Compare with existing quotation amount and update if different
          const existingAmount = parseFloat(vendor.quotation.amount) || 0;
          if (Math.abs(totalAmount - existingAmount) > 0.01) {
            // Using small threshold for float comparison
            vendor.quotation.amount = totalAmount;
            rfqUpdated = true;
          }
        }
      }

      // Save RFQ if any quotation amount was updated
      if (rfqUpdated) {
        await po.rfqId.save();
      }
    }

    res.status(200).json({
      success: true,
      data: po,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching Purchase Order",
      error: error.message,
    });
  }
}

// Update Purchase Order by ID
async function updatePO(req, res) {
  try {
    const { id } = req.params;
    const {
      rfqUpdates,
      vendorId: newVendorId,
      quotationUpdates,
      items,
      ...poUpdateData
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid PO ID",
      });
    }

    // Find the current PO to get RFQ ID
    const currentPO = await PoModel.findById(id).populate("rfqId");
    if (!currentPO) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    // Handle RFQ and vendor updates
    if (currentPO.rfqId) {
      const rfq = await RFQModel.findById(currentPO.rfqId);
      if (rfq) {
        const targetVendorId = newVendorId || currentPO.vednorId.toString();

        // Find the current accepted vendor
        const currentAcceptedVendorIndex = rfq.assignedVendors.findIndex(
          (vendor) =>
            vendor.vendorId.toString() === currentPO.vednorId.toString() &&
            vendor.status === "ACCEPTED"
        );

        // Handle vendor change
        if (newVendorId && newVendorId !== currentPO.vednorId.toString()) {
          // Check if new vendor already exists in assignedVendors
          const newVendorIndex = rfq.assignedVendors.findIndex(
            (vendor) => vendor.vendorId.toString() === newVendorId
          );

          if (newVendorIndex !== -1) {
            // New vendor exists, accept them and reject current one
            rfq.assignedVendors[newVendorIndex].status = "ACCEPTED";
            if (currentAcceptedVendorIndex !== -1) {
              rfq.assignedVendors[currentAcceptedVendorIndex].status =
                "REJECTED";
            }
          } else {
            // New vendor doesn't exist, add them
            rfq.assignedVendors.push({
              vendorId: newVendorId,
              assignedDate: new Date(),
              status: "ACCEPTED",
              quotation: quotationUpdates || {},
            });

            // Reject current vendor
            if (currentAcceptedVendorIndex !== -1) {
              rfq.assignedVendors[currentAcceptedVendorIndex].status =
                "REJECTED";
            }
          }

          // Update PO vendor ID
          poUpdateData.vednorId = newVendorId;
        }

        // Handle items update in RFQ
        if (items && Array.isArray(items)) {
          // Update RFQ items with HSN codes
          rfq.items = items.map((item, index) => ({
            ...item,
            id: index + 1,
            _id: index + 1,
            s_no: index + 1,
          }));
        }

        // Handle quotation updates for current/new vendor
        const vendorIndex = rfq.assignedVendors.findIndex(
          (vendor) =>
            vendor.vendorId.toString() === targetVendorId &&
            vendor.status === "ACCEPTED"
        );

        if (vendorIndex !== -1) {
          // Calculate total amount from items if items are provided
          let calculatedAmount =
            rfq.assignedVendors[vendorIndex].quotation.amount;

          if (items && Array.isArray(items)) {
            calculatedAmount = items.reduce((total, item) => {
              const quantity = parseFloat(item.quantity) || 0;
              const price = parseFloat(item.price) || 0;
              return total + quantity * price;
            }, 0);

            // Update quotation items
            rfq.assignedVendors[vendorIndex].quotation.items = items;
          }

          // Update quotation with new data
          if (quotationUpdates) {
            rfq.assignedVendors[vendorIndex].quotation = {
              ...rfq.assignedVendors[vendorIndex].quotation,
              ...quotationUpdates,
              amount: calculatedAmount, // Use calculated amount
              submittedAt: quotationUpdates.submittedAt
                ? new Date(quotationUpdates.submittedAt)
                : rfq.assignedVendors[vendorIndex].quotation.submittedAt,
              vendorExpectedDeadline: quotationUpdates.vendorExpectedDeadline
                ? new Date(quotationUpdates.vendorExpectedDeadline)
                : rfq.assignedVendors[vendorIndex].quotation
                    .vendorExpectedDeadline,
            };
          } else if (items && Array.isArray(items)) {
            // If only items are updated, just update the amount
            rfq.assignedVendors[vendorIndex].quotation.amount =
              calculatedAmount;
          }
        }

        // Handle other RFQ updates
        if (rfqUpdates) {
          Object.assign(rfq, rfqUpdates);
        }

        await rfq.save();
      }
    }

    // Update Purchase Order
    const updatedPO = await PoModel.findByIdAndUpdate(id, poUpdateData, {
      new: true,
      runValidators: true,
    })
      .populate("vednorId")
      .populate({
        path: "rfqId",
        populate: [
          {
            path: "assignedVendors.vendorId",
            select: "companyName email mobile",
          },
          {
            path: "serviceRequestId",
            populate: {
              path: "clientId",
            },
          },
        ],
      });

    if (!updatedPO) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    // Calculate and update quotation amount if RFQ exists and has assigned vendors
    if (
      updatedPO.rfqId &&
      updatedPO.rfqId.assignedVendors &&
      updatedPO.rfqId.assignedVendors.length > 0
    ) {
      let rfqUpdated = false;

      for (let vendor of updatedPO.rfqId.assignedVendors) {
        if (
          vendor.status === "ACCEPTED" &&
          vendor.quotation &&
          vendor.quotation.items &&
          vendor.quotation.items.length > 0
        ) {
          let totalAmount = 0;

          // Calculate amount for each item with GST
          for (let item of vendor.quotation.items) {
            const quantity = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.price) || 0;
            const gstPercentage = parseFloat(item.gstPercentage) || 0;

            // Calculate current amount (quantity * price)
            const currentAmount = quantity * price;

            // Calculate GST amount
            const gstAmount = (gstPercentage / 100) * currentAmount;

            // Calculate amount with GST
            const amountWithGst = currentAmount + gstAmount;

            // Add to total amount
            totalAmount += amountWithGst;
          }

          // Round to 2 decimal places
          totalAmount = Math.round(totalAmount * 100) / 100;

          // Compare with existing quotation amount and update if different
          const existingAmount = parseFloat(vendor.quotation.amount) || 0;
          if (Math.abs(totalAmount - existingAmount) > 0.01) {
            vendor.quotation.amount = totalAmount;
            rfqUpdated = true;
          }
        }
      }

      // Save RFQ if any quotation amount was updated
      if (rfqUpdated) {
        await updatedPO.rfqId.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Purchase Order and related RFQ updated successfully",
      data: updatedPO,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "PO number already exists",
      });
    }
    res.status(400).json({
      success: false,
      message: "Error updating Purchase Order",
      error: error.message,
    });
  }
}

// Delete Purchase Order by ID
async function deletePO(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid PO ID",
      });
    }

    const deletedPO = await PoModel.findByIdAndDelete(id);

    if (!deletedPO) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Purchase Order deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting Purchase Order",
      error: error.message,
    });
  }
}

// Get Purchase Orders by Vendor ID
async function getPOsByVendor(req, res) {
  try {
    const { vendorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Vendor ID",
      });
    }

    const pos = await PoModel.find({ vednorId: vendorId })
      .populate("vednorId")
      .populate({
        path: "rfqId",
        populate: {
          path: "serviceRequestId",
          populate: {
            path: "clientId",
          },
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: pos.length,
      data: pos,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching Purchase Orders by vendor",
      error: error.message,
    });
  }
}

// Get Purchase Order by RFQ ID
async function getPOByRFQId(req, res) {
  try {
    const { rfqId } = req.params;

    const po = await PoModel.findOne({ rfqId })
      .populate("vednorId")
      .populate({
        path: "rfqId",
        populate: {
          path: "serviceRequestId",
          populate: {
            path: "clientId",
          },
        },
      });

    if (!po) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found for this RFQ",
      });
    }

    res.status(200).json({
      success: true,
      data: po,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching Purchase Order by RFQ ID",
      error: error.message,
    });
  }
}

// Check if PO exists for vendor and RFQ
async function checkPOExists(req, res) {
  try {
    const { vendorId, rfqId } = req.body;

    // Validate input
    if (!vendorId || !rfqId) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID and RFQ ID are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Vendor ID",
      });
    }

    // Check if PO exists with both vendorId and rfqId
    const existingPO = await PoModel.findOne({
      vednorId: vendorId,
      rfqId: rfqId,
    }).populate("vednorId");

    if (existingPO) {
      return res.status(200).json({
        success: true,
        message: "PO is registered",
        isCreated: true,
        data: existingPO,
      });
    } else {
      return res.status(200).json({
        success: true,
        message: "PO is not registered",
        isCreated: false,
        data: null,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error checking PO existence",
      error: error.message,
    });
  }
}

async function checkLastPO(req, res) {
  try {
    const lastPO = await PoModel.findOne().sort({ createdAt: -1 });

    if (!lastPO) {
      return res.status(404).json({
        success: false,
        message: "No Purchase Orders found",
      });
    }

    res.status(200).json({
      success: true,
      data: lastPO,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching the last Purchase Order",
      error: error.message,
    });
  }
}

module.exports = {
  createPO,
  getAllPOs,
  getPOById,
  updatePO,
  deletePO,
  getPOsByVendor,
  getPOByRFQId,
  checkPOExists,
  checkLastPO,
};
