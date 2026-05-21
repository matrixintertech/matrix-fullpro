const { RFQModel } = require("./rfqModal");
const { SupplierModal } = require("../supplier/supplier-modal");
const {
  ServiceRequestModal,
} = require("../serviceRequests/service-request-model");
const mongoose = require("mongoose");

// Create a new RFQ with vendor assignment
async function createRFQ(req, res) {
  try {
    const {
      title,
      category,
      description,
      type,
      expectedDeadline,
      items,
      createdByservicePartnerUserId,
      servicePartnerId,
      serviceRequestId,
      vendorIds, // Array of vendor IDs to assign
      paymentTerms,
      freightExtra,
    } = req.body;

    // Handle freightExtra field - convert string to proper object format
    let processedFreightExtra = freightExtra;
    if (freightExtra && typeof freightExtra === "string") {
      processedFreightExtra = {
        isApplicable: true,
        amount: parseFloat(freightExtra) || 0,
      };
    }

    // Validate vendors exist and match category
    // if (vendorIds && vendorIds.length > 0) {
    //   const vendors = await SupplierModal.find({
    //     _id: { $in: vendorIds },
    //     dealingIn: { $in: [category] },
    //   });

    //   if (vendors.length === 0) {
    //     return res.status(400).json({
    //       success: false,
    //       message: "No qualified vendors found for this RFQ category",
    //     });
    //   }

    //   if (vendors.length !== vendorIds.length) {
    //     return res.status(400).json({
    //       success: false,
    //       message:
    //         "Some vendor IDs are invalid or don't match the RFQ category",
    //     });
    //   }
    // }

    // Generate 5 random numbers
    const randomNumbers = Math.floor(10000 + Math.random() * 90000);

    // Populate serviceRequestId to get serviceNumber
    const serviceRequest = await ServiceRequestModal.findById(serviceRequestId);

    if (!serviceRequest || !serviceRequest.serviceNumber) {
      return res
        .status(400)
        .json({ error: "Invalid serviceRequestId or serviceNumber not found" });
    }

    // Create rfqNo by combining serviceNumber with random numbers
    const rfqNo = `RFQ-${serviceRequest.serviceNumber}-${randomNumbers}`;

    // Prepare assigned vendors array
    const assignedVendors = vendorIds
      ? vendorIds.map((vendorId) => ({
          vendorId,
          status: "PENDING",
        }))
      : [];

    // Create RFQ with assigned vendors
    const rfq = new RFQModel({
      title,
      category,
      description,
      type,
      expectedDeadline,
      items,
      createdByservicePartnerUserId,
      servicePartnerId,
      serviceRequestId,
      rfqNo,
      status: assignedVendors.length > 0 ? "SENT" : "DRAFT",
      assignedVendors,
      paymentTerms,
      freightExtra: processedFreightExtra,
    });

    await rfq.save();

    // Populate vendor details in response
    await rfq.populate("assignedVendors.vendorId", "companyName email");

    // Calculate and update quotation amount if RFQ has assigned vendors with quotations
    if (rfq.assignedVendors && rfq.assignedVendors.length > 0) {
      let rfqUpdated = false;

      for (let vendor of rfq.assignedVendors) {
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
        await rfq.save();
      }
    }

    res.status(201).json({ message: "RFQ created successfully", rfq });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

// Get all RFQs
async function getAllRFQs(req, res) {
  try {
    const rfqs = await RFQModel.find()
      .populate("createdByservicePartnerUserId", "name email mobile")
      .populate("servicePartnerId", "name")
      .populate("poId")
      // .populate("products.items")
      .populate({
        path: "assignedVendors.vendorId",
        model: "Supplier",
      })
      .populate({
        path: "serviceRequestId",
        populate: {
          path: "branch_id",
          model: "Branch",
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json(rfqs);
  } catch (error) {
    res.status(500).json({ message: error.message, error: error.message });
  }
}

// Get RFQ by ID
async function getRFQById(req, res) {
  try {
    const { id, vendorId } = req.query;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "RFQ ID is required",
      });
    }

    // Base query to find RFQ
    const rfq = await RFQModel.findById(id)
      .populate("createdByservicePartnerUserId", "name email mobile")
      .populate("servicePartnerId", "name")
      .populate("serviceRequestId", "serviceNumber title _id")
      .populate("poId")
      .populate("assignedVendors.vendorId");

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: "RFQ not found",
      });
    }

    // Calculate and update quotation amount if RFQ has assigned vendors with quotations
    if (rfq.assignedVendors && rfq.assignedVendors.length > 0) {
      let rfqUpdated = false;

      for (let vendor of rfq.assignedVendors) {
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
        await rfq.save();
      }
    }

    // If vendorId is provided, filter to show only that vendor's information
    if (vendorId) {
      // Find the specific vendor in assignedVendors array
      const vendorInfo = rfq.assignedVendors.find(
        (vendor) => vendor.vendorId._id.toString() === vendorId
      );

      if (!vendorInfo) {
        return res.status(404).json({
          success: false,
          message: "Vendor not found in this RFQ",
        });
      }

      // Return RFQ with only the specific vendor's information
      const filteredRFQ = {
        _id: rfq._id,
        title: rfq.title,
        category: rfq.category,
        description: rfq.description,
        type: rfq.type,
        expectedDeadline: rfq.expectedDeadline,
        items: rfq.items,
        rfqNo: rfq.rfqNo,
        status: rfq.status,
        createdAt: rfq.createdAt,
        updatedAt: rfq.updatedAt,
        createdByservicePartnerUserId: rfq.createdByservicePartnerUserId,
        servicePartnerId: rfq.servicePartnerId,
        serviceRequestId: rfq.serviceRequestId,
        assignedVendor: {
          vendorId: vendorInfo.vendorId,
          status: vendorInfo.status,
          quotation: vendorInfo.quotation,
          assignedDate: vendorInfo.assignedDate,
        },
      };

      return res.status(200).json({
        success: true,
        data: filteredRFQ,
      });
    }

    // If no vendorId provided, return complete RFQ details
    res.status(200).json({
      success: true,
      data: {
        ...rfq._doc,
        paymentTerms: rfq.paymentTerms,
        freightExtra: rfq.freightExtra,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
}

// Update RFQ by ID
async function updateRFQ(req, res) {
  try {
    const updateData = { ...req.body };

    // Handle freightExtra field - convert string to proper object format
    if (updateData.freightExtra) {
      if (typeof updateData.freightExtra === "string") {
        // If freightExtra is sent as string, convert to object format
        updateData.freightExtra = {
          isApplicable: true,
          amount: parseFloat(updateData.freightExtra) || 0,
        };
      }
    }

    // Handle vendorIds conversion to assignedVendors
    if (updateData.vendorIds && Array.isArray(updateData.vendorIds)) {
      // First, get the existing RFQ to check current assigned vendors
      const existingRFQ = await RFQModel.findById(req.params.id);

      if (!existingRFQ) {
        return res.status(404).json({
          success: false,
          message: "RFQ not found",
        });
      }

      // Get existing vendor IDs to avoid duplicates
      const existingVendorIds = existingRFQ.assignedVendors.map((vendor) =>
        vendor.vendorId.toString()
      );

      // Filter out vendors that are already assigned
      const newVendorIds = updateData.vendorIds.filter(
        (vendorId) => !existingVendorIds.includes(vendorId)
      );

      // Only check for ACCEPTED status if there are actually new vendors to add
      if (newVendorIds.length > 0) {
        // Check if any existing vendor has ACCEPTED status
        const hasAcceptedVendor = existingRFQ.assignedVendors.some(
          (vendor) => vendor.status === "ACCEPTED"
        );

        if (hasAcceptedVendor) {
          return res.status(400).json({
            success: false,
            message:
              "Cannot add new vendors as one vendor's quotation is already accepted/approved",
          });
        }

        // Create new vendor assignments for only new vendors
        const newVendorAssignments = newVendorIds.map((vendorId) => ({
          vendorId,
          status: "PENDING",
          assignedDate: new Date(),
        }));

        // Combine existing vendors with new vendors
        updateData.assignedVendors = [
          ...existingRFQ.assignedVendors,
          ...newVendorAssignments,
        ];

        // Update RFQ status to SENT if vendors are assigned
        if (updateData.assignedVendors.length > 0) {
          updateData.status = "SENT";
        }
      } else {
        // No new vendors to add, preserve existing assignedVendors
        updateData.assignedVendors = existingRFQ.assignedVendors;
      }

      // Remove vendorIds from update data since it's not part of the schema
      delete updateData.vendorIds;
    }

    const updatedRFQ = await RFQModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("createdByservicePartnerUserId", "name email mobile")
      .populate("servicePartnerId", "name")
      .populate("serviceRequestId", "serviceNumber title")
      .populate({
        path: "assignedVendors.vendorId",
        model: "Supplier",
        select: "companyName email mobile contactNumber address",
      });

    if (!updatedRFQ) {
      return res.status(404).json({
        success: false,
        message: "RFQ not found",
      });
    }

    // Calculate and update quotation amount if RFQ has assigned vendors with quotations
    if (updatedRFQ.assignedVendors && updatedRFQ.assignedVendors.length > 0) {
      let rfqUpdated = false;

      for (let vendor of updatedRFQ.assignedVendors) {
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
        await updatedRFQ.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "RFQ updated successfully",
      data: updatedRFQ,
    });
  } catch (error) {
    console.error("Error updating RFQ:", error);

    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${duplicateField} already exists`,
        error: error.message,
      });
    }

    res.status(400).json({
      success: false,
      message: "Error updating RFQ",
      error: error.message,
    });
  }
}

async function updateRFQByVendorId(req, res) {
  try {
    const { vendorId, rfqId } = req.params;
    const updateData = req.body;

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(rfqId) ||
      !mongoose.Types.ObjectId.isValid(vendorId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid RFQ ID or Vendor ID",
      });
    }

    // Check if RFQ exists and vendor is assigned to it
    const rfq = await RFQModel.findOne({
      _id: rfqId,
      "assignedVendors.vendorId": vendorId,
    });

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: "RFQ not found or vendor not assigned to this RFQ",
      });
    }

    // Prepare update object for the specific vendor's quotation items
    const updateFields = {};

    if (updateData.items) {
      updateFields["assignedVendors.$.quotation.items"] = updateData.items;
    }

    // If other quotation fields need to be updated
    if (updateData.amount) {
      updateFields["assignedVendors.$.quotation.amount"] = updateData.amount;
    }

    if (updateData.details) {
      updateFields["assignedVendors.$.quotation.details"] = updateData.details;
    }

    if (updateData.vendorExpectedDeadline) {
      updateFields["assignedVendors.$.quotation.vendorExpectedDeadline"] =
        updateData.vendorExpectedDeadline;
    }

    // Update the specific vendor's quotation
    const updatedRFQ = await RFQModel.findOneAndUpdate(
      {
        _id: rfqId,
        "assignedVendors.vendorId": vendorId,
      },
      {
        $set: updateFields,
      },
      { new: true, runValidators: true }
    )
      .populate("createdByservicePartnerUserId", "name email mobile")
      .populate("servicePartnerId", "name")
      .populate("serviceRequestId", "serviceNumber title")
      .populate(
        "assignedVendors.vendorId",
        "companyName email mobile contactNumber address"
      );

    if (!updatedRFQ) {
      return res.status(404).json({
        success: false,
        message: "Failed to update RFQ quotation",
      });
    }

    // Find the updated vendor's data
    const updatedVendorData = updatedRFQ.assignedVendors.find(
      (vendor) => vendor.vendorId._id.toString() === vendorId
    );

    // Calculate and update quotation amount for the updated vendor
    if (
      updatedVendorData &&
      updatedVendorData.quotation &&
      updatedVendorData.quotation.items &&
      updatedVendorData.quotation.items.length > 0
    ) {
      let totalAmount = 0;

      // Calculate amount for each item with GST
      for (let item of updatedVendorData.quotation.items) {
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
      const existingAmount =
        parseFloat(updatedVendorData.quotation.amount) || 0;
      if (Math.abs(totalAmount - existingAmount) > 0.01) {
        // Update the quotation amount for this specific vendor
        await RFQModel.findOneAndUpdate(
          {
            _id: rfqId,
            "assignedVendors.vendorId": vendorId,
          },
          {
            $set: {
              "assignedVendors.$.quotation.amount": totalAmount,
            },
          }
        );

        // Update the local data for response
        updatedVendorData.quotation.amount = totalAmount;
      }
    }

    res.status(200).json({
      success: true,
      message: "RFQ quotation updated successfully",
      data: {
        rfqId: updatedRFQ._id,
        rfqNumber: updatedRFQ.rfqNo,
        vendorId: updatedVendorData.vendorId._id,
        vendorName: updatedVendorData.vendorId.companyName,
        updatedQuotation: updatedVendorData.quotation,
        status: updatedVendorData.status,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating RFQ quotation",
      error: error.message,
    });
  }
}

// Delete RFQ by ID
async function deleteRFQ(req, res) {
  try {
    const deletedRFQ = await RFQModel.findByIdAndDelete(req.params.id);

    if (!deletedRFQ) {
      return res.status(404).json({ message: "RFQ not found" });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message, error: error.message });
  }
}

// Delete Quotation by Vendor ID
async function deleteQuotationByVendorId(req, res) {
  try {
    const { rfqId, vendorId } = req.params;

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(rfqId) ||
      !mongoose.Types.ObjectId.isValid(vendorId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid RFQ ID or Vendor ID",
      });
    }

    // Check if RFQ exists and vendor is assigned to it
    const rfq = await RFQModel.findOne({
      _id: rfqId,
      "assignedVendors.vendorId": vendorId,
    });

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: "RFQ not found or vendor not assigned to this RFQ",
      });
    }

    // Check if the vendor has a quotation
    const vendorData = rfq.assignedVendors.find(
      (vendor) => vendor.vendorId.toString() === vendorId
    );

    if (!vendorData || !vendorData.quotation) {
      return res.status(404).json({
        success: false,
        message: "No quotation found for this vendor",
      });
    }

    // Delete the vendor's quotation and reset status to PENDING
    const updatedRFQ = await RFQModel.findOneAndUpdate(
      {
        _id: rfqId,
        "assignedVendors.vendorId": vendorId,
      },
      {
        $unset: {
          "assignedVendors.$.quotation": "",
        },
        $set: {
          "assignedVendors.$.status": "PENDING",
        },
      },
      { new: true }
    )
      .populate("createdByservicePartnerUserId", "name email mobile")
      .populate("servicePartnerId", "name")
      .populate("serviceRequestId", "serviceNumber title")
      .populate(
        "assignedVendors.vendorId",
        "companyName email mobile contactNumber address"
      );

    if (!updatedRFQ) {
      return res.status(404).json({
        success: false,
        message: "Failed to delete quotation",
      });
    }

    res.status(200).json({
      success: true,
      message: "Quotation deleted successfully",
      data: {
        rfqId: updatedRFQ._id,
        rfqNumber: updatedRFQ.rfqNo,
        vendorId: vendorId,
        message:
          "Vendor quotation has been removed and status reset to PENDING",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting quotation",
      error: error.message,
    });
  }
}

// Get RFQs by Service Partner
async function getRFQsByServicePartner(req, res) {
  try {
    const { servicePartnerId } = req.params;

    const rfqs = await RFQModel.find({ servicePartnerId })
      .populate("createdByservicePartnerUserId", "name email mobile")
      .populate("servicePartnerId", "name")
      .populate("products.items")
      .sort({ createdAt: -1 });

    res.status(200).json(rfqs);
  } catch (error) {
    res.status(500).json({ message: error.message, error: error.message });
  }
}

// Get RFQs by User
async function getRFQsByUser(req, res) {
  try {
    const { userId } = req.params;

    const rfqs = await RFQModel.find({ createdByservicePartnerUserId: userId })
      .populate("createdByservicePartnerUserId", "name email mobile")
      .populate("servicePartnerId", "name")
      .populate("assignedVendors.vendorId", "companyName email")
      .populate("products.items")
      .sort({ createdAt: -1 });

    res.status(200).json(rfqs);
  } catch (error) {
    res.status(500).json({ message: error.message, error: error.message });
  }
}

// Get RFQs by category
async function getRFQsByCategory(req, res) {
  try {
    const { category } = req.params;

    const rfqs = await RFQModel.find({ category })
      .populate("createdByservicePartnerUserId", "name email mobile")
      .populate("servicePartnerId", "name")
      .populate("products.items")
      .sort({ createdAt: -1 });

    res.status(200).json(rfqs);
  } catch (error) {
    res.status(500).json({ message: error.message, error: error.message });
  }
}

// Get RFQs by vendor ID
async function getRFQsByVendorId(req, res) {
  try {
    const { vendorId } = req.params;

    const rfqs = await RFQModel.find({
      "assignedVendors.vendorId": vendorId,
    })
      .populate({
        path: "serviceRequestId",
        select: "serviceNumber title description",
      })
      .populate({
        path: "createdByservicePartnerUserId",
        select: "name email",
      })
      .populate({
        path: "servicePartnerId",
        select: "name",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: rfqs.length,
      data: rfqs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching RFQs",
      error: error.message,
    });
  }
}

// Get RFQs by Service Request ID
async function getRFQsByServiceRequestId(req, res) {
  try {
    const { serviceRequestId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(serviceRequestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service request ID",
      });
    }

    const rfqs = await RFQModel.find({ serviceRequestId })
      .populate("createdByservicePartnerUserId", "name email mobile")
      .populate("servicePartnerId", "name")
      .populate("serviceRequestId", "serviceNumber title description")
      .populate({
        path: "assignedVendors.vendorId",
        model: "Vendor",
        select: "companyName email mobile contactNumber address",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: rfqs.length,
      data: rfqs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching RFQs by service request ID",
      error: error.message,
    });
  }
}

// Submit quotation for an RFQ
async function submitQuotation(req, res) {
  try {
    const { rfqId, vendorId } = req.params;
    const { items, totalAmount, details, vendorExpectedDeadline } = req.body;

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(rfqId) ||
      !mongoose.Types.ObjectId.isValid(vendorId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid RFQ ID or Vendor ID",
      });
    }

    // Find the RFQ and check if the vendor is assigned
    const rfq = await RFQModel.findOne({
      _id: rfqId,
      "assignedVendors.vendorId": vendorId,
    });

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: "RFQ not found or vendor not assigned to this RFQ",
      });
    }

    // Find the vendor's assignment in the RFQ
    const vendorAssignment = rfq.assignedVendors.find(
      (v) => v.vendorId.toString() === vendorId
    );

    // Process items to ensure gstPercentage is included
    const processedItems = items.map((item) => ({
      ...item,
      gstPercentage: item.gstPercentage || 0, // Default to 0 if not provided
    }));

    // Allow updating existing quotation
    // Update the vendor's quotation
    const updatedRfq = await RFQModel.findOneAndUpdate(
      {
        _id: rfqId,
        "assignedVendors.vendorId": vendorId,
      },
      {
        $set: {
          "assignedVendors.$.status": "RESPONDED",
          "assignedVendors.$.quotation": {
            amount: totalAmount,
            details: details,
            items: processedItems,
            submittedAt: new Date(),
            vendorExpectedDeadline: vendorExpectedDeadline,
          },
        },
      },
      { new: true }
    ).populate("assignedVendors.vendorId", "companyName email");

    res.status(200).json({
      success: true,
      message: "Quotation submitted successfully",
      data: updatedRfq,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error submitting quotation",
      error: error.message,
    });
  }
}

// Get all quotations for a specific RFQ
async function getQuotationsByRfqId(req, res) {
  try {
    const { rfqId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(rfqId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid RFQ ID",
      });
    }

    const rfq = await RFQModel.findById(rfqId).populate({
      path: "assignedVendors.vendorId",
    });
    // .populate({
    //   path: "assignedVendors.quotation.items.item",
    //   select: "name description category",
    // });

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: "RFQ not found",
      });
    }
    // Filter only vendors who have submitted quotations and map their data
    const quotations = rfq.assignedVendors
      .filter((vendor) => vendor.quotation && vendor.quotation.submittedAt)
      .map((vendor) => ({
        vendorId: vendor.vendorId._id,
        vendorName: vendor.vendorId.name || vendor.vendorId.companyName,
        vendorEmail: vendor.vendorId.email,
        vendorContact: vendor.vendorId.mobile || vendor.vendorId.contactNumber,
        vendorAddress: vendor.vendorId.address,
        quotationDetails: {
          items: vendor.quotation.items,
          totalAmount: vendor.quotation.amount,
          details: vendor.quotation.details,
          submittedAt: vendor.quotation.submittedAt,
          vendorExpectedDeadline: vendor.quotation.vendorExpectedDeadline,
        },
        status: vendor.status,
      }));

    res.status(200).json({
      success: true,
      rfqTitle: rfq.title,
      rfqNumber: rfq.rfqNo,
      rfqDescription: rfq.description,
      rfqCategory: rfq.category,
      rfqExpectedDeadline: rfq.expectedDeadline,
      totalVendorsAssigned: rfq.assignedVendors.length,
      totalQuotations: quotations.length,
      quotations: quotations,
      allVendorsStatus: rfq.assignedVendors.map((v) => ({
        vendorId: v.vendorId._id,
        vendorName: v.vendorId.name || v.vendorId.companyName,
        status: v.status,
        hasQuotation: !!v.quotation && !!v.quotation.submittedAt,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching quotations",
      error: error.message,
    });
  }
}

// Approve or reject a quotation
async function handleQuotationResponse(req, res) {
  try {
    const { rfqId, vendorId } = req.params;
    const { action } = req.body; // action should be either 'ACCEPT' or 'REJECT'

    // Validate action
    if (!["ACCEPT", "REJECT"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be either 'ACCEPT' or 'REJECT'",
      });
    }

    // Find the RFQ
    const rfq = await RFQModel.findById(rfqId);
    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: "RFQ not found",
      });
    }

    // Check if any quotation is already accepted
    if (
      action === "ACCEPT" &&
      rfq.assignedVendors.some((v) => v.status === "ACCEPTED")
    ) {
      return res.status(400).json({
        success: false,
        message: "Another quotation has already been accepted for this RFQ",
      });
    }

    // Update the vendor's quotation status
    const updatedRfq = await RFQModel.findOneAndUpdate(
      {
        _id: rfqId,
        "assignedVendors.vendorId": vendorId,
        "assignedVendors.status": "RESPONDED", // Only allow response for submitted quotations
      },
      {
        $set: {
          "assignedVendors.$.status":
            action === "ACCEPT" ? "ACCEPTED" : "REJECTED",
          ...(action === "ACCEPT" && { status: "ACCEPTED" }), // Update main RFQ status if accepting
        },
      },
      { new: true }
    ).populate("assignedVendors.vendorId", "companyName email");

    if (!updatedRfq) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found or not in valid state for this action",
      });
    }

    // If accepting one quotation, reject all others
    if (action === "ACCEPT") {
      await RFQModel.updateOne(
        { _id: rfqId },
        {
          $set: {
            "assignedVendors.$[other].status": "REJECTED",
          },
        },
        {
          arrayFilters: [
            {
              "other.vendorId": { $ne: vendorId },
              "other.status": "RESPONDED",
            },
          ],
        }
      );
    }

    res.status(200).json({
      success: true,
      message: `Quotation ${action.toLowerCase()}ed successfully`,
      data: updatedRfq,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error processing quotation response",
      error: error.message,
    });
  }
}

// Get detailed quotation information by RFQ ID and Vendor ID
async function getQuotationDetails(req, res) {
  try {
    const { rfqId, vendorId } = req.params;

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(rfqId) ||
      !mongoose.Types.ObjectId.isValid(vendorId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid RFQ ID or Vendor ID",
      });
    }

    const rfq = await RFQModel.findById(rfqId)
      .populate("serviceRequestId", "serviceNumber")
      .populate("assignedVendors.vendorId");
    // .populate(
    //   "assignedVendors.quotation.items.item",
    //   "name description category"
    // );

    if (!rfq) {
      return res.status(404).json({
        success: false,
        message: "RFQ not found",
      });
    }

    // Find the specific vendor's quotation
    const vendorQuotation = rfq.assignedVendors.find(
      (v) => v.vendorId._id.toString() === vendorId
    );

    if (!vendorQuotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found for this vendor",
      });
    }

    // Format response to match the UI requirements
    const response = {
      success: true,
      data: {
        rfqDetails: {
          _id: rfq._id,
          title: rfq.title,
          rfqNumber: rfq.rfqNo,
          expectedDeadline: rfq.expectedDeadline,
          description: rfq.description,
          category: rfq.category,
          type: rfq.type,
          items: rfq.items,
          paymentTerms: rfq.paymentTerms,
          freightExtra: rfq.freightExtra,
          serviceRequestId: rfq.serviceRequestId,
          createdAt: rfq.createdAt,
          updatedAt: rfq.updatedAt,
        },
        quotationDetails: {
          vendorId: vendorQuotation.vendorId._id,
          vendorInfo: {
            companyName: vendorQuotation.vendorId.name,
            name: vendorQuotation.vendorId.contact_name,
            email: vendorQuotation.vendorId.email,
            contactNumber: vendorQuotation.vendorId.mobile,
            address: vendorQuotation.vendorId.address,
          },
          status: vendorQuotation.status,
          assignedDate: vendorQuotation.assignedDate,
          quotation: vendorQuotation.quotation
            ? {
                amount: vendorQuotation.quotation.amount,
                details: vendorQuotation.quotation.details,
                submittedAt: vendorQuotation.quotation.submittedAt,
                vendorExpectedDeadline:
                  vendorQuotation.quotation.vendorExpectedDeadline,
                items:
                  vendorQuotation.quotation.items?.map((item) => ({
                    _id: item._id,
                    itemName: item.itemName,
                    unit: item.unit,
                    quantity: item.quantity,
                    description: item.description,
                    price: item.price,
                    hsnCode: item.hsnCode,
                    gstPercentage: item.gstPercentage,
                  })) || [],
              }
            : null,
        },
      },
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching quotation details",
      error: error.message,
    });
  }
}

// Get all quotations for all RFQs
async function getAllQuotations(req, res) {
  try {
    const {
      servicePartnerId,
      status,
      vendorId,
      rfqId,
      sortBy = "submittedAt",
      sortOrder = "desc",
      page = 1,
      limit: limitParam,
    } = req.query;

    // Handle limit - if "all" or not provided, fetch all data; otherwise use the provided limit
    const limit =
      limitParam === "all" || limitParam === undefined
        ? 10000
        : parseInt(limitParam) || 10;

    // Build query filters
    const matchQuery = {};

    if (servicePartnerId) {
      matchQuery.servicePartnerId = new mongoose.Types.ObjectId(
        servicePartnerId
      );
    }

    if (rfqId) {
      matchQuery._id = new mongoose.Types.ObjectId(rfqId);
    }

    // Build vendor filter for assignedVendors array
    const vendorFilter = {};
    if (status) {
      vendorFilter["assignedVendors.status"] = status;
    }
    if (vendorId) {
      vendorFilter["assignedVendors.vendorId"] = new mongoose.Types.ObjectId(
        vendorId
      );
    }

    // Apply vendor filters to match query
    Object.assign(matchQuery, vendorFilter);

    // Aggregation pipeline to get all quotations
    const pipeline = [
      { $match: matchQuery },
      { $unwind: "$assignedVendors" },
      {
        $match: {
          "assignedVendors.quotation": { $exists: true },
          $or: [
            // Include quotations with valid statuses
            {
              "assignedVendors.status": {
                $in: ["RESPONDED", "ACCEPTED", "REJECTED", "APPROVED"],
              },
            },
            // Include quotations for RFQs that have a PO (if PO exists, there must be a quotation)
            {
              $and: [
                { poId: { $exists: true, $ne: null } },
                { "assignedVendors.status": "ACCEPTED" },
                { "assignedVendors.quotation": { $exists: true, $ne: null } },
              ],
            },
          ],
        },
      },
      // Lookup supplier details
      {
        $lookup: {
          from: "suppliers",
          localField: "assignedVendors.vendorId",
          foreignField: "_id",
          as: "supplierDetails",
        },
      },
      // Lookup vendor details
      {
        $lookup: {
          from: "vendors",
          localField: "assignedVendors.vendorId",
          foreignField: "_id",
          as: "vendorDetails",
        },
      },
      {
        $addFields: {
          mergedVendor: {
            $cond: [
              { $gt: [{ $size: "$supplierDetails" }, 0] },
              { $arrayElemAt: ["$supplierDetails", 0] },
              { $arrayElemAt: ["$vendorDetails", 0] },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "servicepartners",
          localField: "servicePartnerId",
          foreignField: "_id",
          as: "servicePartnerDetails",
        },
      },
      {
        $lookup: {
          from: "servicerequests",
          localField: "serviceRequestId",
          foreignField: "_id",
          as: "serviceRequestDetails",
        },
      },
      {
        $lookup: {
          from: "pos",
          localField: "poId",
          foreignField: "_id",
          as: "poDetails",
        },
      },

      {
        $project: {
          _id: 1,
          rfqTitle: "$title",
          rfqNumber: "$rfqNo",
          rfqCategory: "$category",
          rfqDescription: "$description",
          rfqExpectedDeadline: "$expectedDeadline",
          rfqStatus: "$status",
          rfqCreatedAt: "$createdAt",
          servicePartner: {
            $arrayElemAt: ["$servicePartnerDetails.name", 0],
          },
          serviceRequest: {
            serviceNumber: {
              $arrayElemAt: ["$serviceRequestDetails.serviceNumber", 0],
            },
            title: { $arrayElemAt: ["$serviceRequestDetails.title", 0] },
          },
          vendor: {
            _id: "$assignedVendors.vendorId",
            companyName: { $ifNull: ["$mergedVendor.name", "N/A"] },
            name: { $ifNull: ["$mergedVendor.contact_name", "N/A"] },
            email: { $ifNull: ["$mergedVendor.email", "N/A"] },
            mobile: { $ifNull: ["$mergedVendor.mobile", "N/A"] },
            contactPerson: { $ifNull: ["$mergedVendor.contactPerson", "N/A"] },
            address: { $ifNull: ["$mergedVendor.address", "N/A"] },
          },
          po: {
            _id: { $arrayElemAt: ["$poDetails._id", 0] },
            poNumber: { $arrayElemAt: ["$poDetails.poNumber", 0] },
            createdAt: { $arrayElemAt: ["$poDetails.createdAt", 0] },
            status: { $arrayElemAt: ["$poDetails.status", 0] },
          },
          quotation: {
            amount: "$assignedVendors.quotation.amount",
            details: "$assignedVendors.quotation.details",
            items: "$assignedVendors.quotation.items",
            submittedAt: "$assignedVendors.quotation.submittedAt",
            status: "$assignedVendors.status",
            assignedDate: "$assignedVendors.assignedDate",
          },
        },
      },
      {
        $sort: {
          [`quotation.${sortBy}`]: sortOrder === "desc" ? -1 : 1,
        },
      },
      // Build facet stage based on whether we want all data or paginated data
      ...(limit >= 10000
        ? [
            // For "all" data, just count and return everything
            {
              $group: {
                _id: null,
                quotations: { $push: "$$ROOT" },
                totalCount: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                quotations: 1,
                totalCount: 1,
              },
            },
          ]
        : [
            // For paginated data, use $facet
            {
              $facet: {
                quotations: [
                  { $skip: (parseInt(page) - 1) * limit },
                  { $limit: limit },
                ],
                totalCount: [{ $count: "count" }],
              },
            },
          ]),
    ];

    const result = await RFQModel.aggregate(pipeline);
    // Handle different result structures based on pagination
    let quotations, totalCount;
    if (limit >= 10000) {
      // For "all" data, result structure is different
      quotations = result[0]?.quotations || [];
      totalCount = result[0]?.totalCount || 0;
    } else {
      // For paginated data, use standard $facet structure
      quotations = result[0]?.quotations || [];
      totalCount = result[0]?.totalCount[0]?.count || 0;
    }

    // Log assigned vendor details for debugging
    if (quotations && quotations.length > 0) {
      quotations.forEach((q, idx) => {});
    }

    // Calculate summary statistics
    const summaryPipeline = [
      { $match: matchQuery },
      { $unwind: "$assignedVendors" },
      {
        $match: {
          "assignedVendors.quotation": { $exists: true },
          $or: [
            // Include quotations with valid statuses
            {
              "assignedVendors.status": {
                $in: ["RESPONDED", "ACCEPTED", "REJECTED", "APPROVED"],
              },
            },
            // Include quotations for RFQs that have a PO (if PO exists, there must be a quotation)
            {
              $and: [
                { poId: { $exists: true, $ne: null } },
                { "assignedVendors.status": "ACCEPTED" },
                { "assignedVendors.quotation": { $exists: true, $ne: null } },
              ],
            },
          ],
        },
      },
      {
        $group: {
          _id: null,
          totalQuotations: { $sum: 1 },
          totalAmount: { $sum: "$assignedVendors.quotation.amount" },
          averageAmount: { $avg: "$assignedVendors.quotation.amount" },
          acceptedQuotations: {
            $sum: {
              $cond: [{ $eq: ["$assignedVendors.status", "ACCEPTED"] }, 1, 0],
            },
          },
          rejectedQuotations: {
            $sum: {
              $cond: [{ $eq: ["$assignedVendors.status", "REJECTED"] }, 1, 0],
            },
          },
          pendingQuotations: {
            $sum: {
              $cond: [{ $eq: ["$assignedVendors.status", "RESPONDED"] }, 1, 0],
            },
          },
        },
      },
    ];

    const summaryResult = await RFQModel.aggregate(summaryPipeline);
    const summary = summaryResult[0] || {
      totalQuotations: 0,
      totalAmount: 0,
      averageAmount: 0,
      acceptedQuotations: 0,
      rejectedQuotations: 0,
      pendingQuotations: 0,
    };

    res.status(200).json({
      success: true,
      message: "All quotations fetched successfully",
      data: {
        quotations,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalItems: totalCount,
          itemsPerPage: parseInt(limit),
        },
        summary: {
          totalQuotations: summary.totalQuotations,
          totalAmount: summary.totalAmount,
          averageAmount: Math.round(summary.averageAmount || 0),
          statusBreakdown: {
            accepted: summary.acceptedQuotations,
            rejected: summary.rejectedQuotations,
            pending: summary.pendingQuotations,
          },
        },
        filters: {
          servicePartnerId: servicePartnerId || null,
          status: status || null,
          vendorId: vendorId || null,
          rfqId: rfqId || null,
          sortBy,
          sortOrder,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching all quotations",
      error: error.message,
    });
  }
}

// Approve RFQ (set status to 'APPROVED')
async function approveRFQ(req, res) {
  try {
    const { rfqId } = req.params;
    const status = req.body.status;
    if (!rfqId) {
      return res
        .status(400)
        .json({ success: false, message: "RFQ ID is required" });
    }
    const rfq = await RFQModel.findByIdAndUpdate(
      rfqId,
      { status: status },
      { new: true }
    );
    if (!rfq) {
      return res.status(404).json({ success: false, message: "RFQ not found" });
    }
    res.status(200).json({
      success: true,
      message: `RFQ ${status} successfully`,
      data: rfq,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error approving RFQ",
      error: error.message,
    });
  }
}

module.exports = {
  createRFQ,
  getAllRFQs,
  getRFQById,
  updateRFQ,
  deleteRFQ,
  getRFQsByServicePartner,
  getRFQsByUser,
  getRFQsByCategory,
  getRFQsByVendorId,
  getRFQsByServiceRequestId, // Add the new function
  submitQuotation,
  getQuotationsByRfqId,
  handleQuotationResponse,
  getQuotationDetails,
  approveRFQ,
  getAllQuotations,
  updateRFQByVendorId,
  deleteQuotationByVendorId,
};
