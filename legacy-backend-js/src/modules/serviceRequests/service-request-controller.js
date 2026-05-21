const { default: mongoose } = require("mongoose");
const { generateRequestNumber } = require("../../utils/helpers");
const { validateObjectId } = require("../../utils/validations");
const AssignServiceModel = require("../assign-serivce/assign-service-model");
const { ClientUserModal } = require("../client-user/clientUser-modal");
const { ClientModel } = require("../client/client-model");
const { ServiceRequestModal, Status } = require("./service-request-model");

// Create a new Service Request
const createRequest = async (req, res) => {
  try {
    const { clientId, ...rest } = req.body;

    const clientName = await ClientModel.findOne({ _id: clientId }).select(
      "client_name"
    );

    const newRequest = new ServiceRequestModal({
      clientId,
      ...rest,
      serviceNumber: await generateRequestNumber(
        "SR",
        clientName?.client_name,
        ServiceRequestModal,
        "serviceNumber"
      ),
    });

    await newRequest.save();
    res.status(201).json({
      message: "Service Request created successfully.",
      data: newRequest,
    });
  } catch (error) {
    console.log(error, "Eroor");

    res.status(500).json({
      message: "Error creating Service Request.",
      error: error.message,
    });
  }
};
// Get all Service Requests

const getServiceRequestsByServicePartnerId = async (req, res) => {
  try {
    const servicePartnerId = req.params?.servicePartnerId;

    // Fetch all service requests by clientId and populate related fields
    const requests = await ServiceRequestModal.find({
      servicePartnerId,
      ...req?.query,
    })
      .populate("pmAssigned")
      .populate("smAssigned")
      .populate("quotation")
      .populate("branch_id")
      .populate("users")
      .populate("clientUserId")
      .populate("createdByservicePartnerUserId")
      .populate("createdByclientUserId")
      .populate({
        path: "ServiceTargetStatusLog",
        populate: { path: "user_id" },
      })
      .sort({ createdAt: -1 });

    // Respond with the fetched data
    // console.log(requests, "requestsrequests");
    res.status(200).json({ data: requests });
  } catch (error) {
    // Handle errors
    res.status(500).json({
      message: "Error fetching Service Requests.",
      error: error.message,
    });
  }
};

const getServiceRequestsByClientId = async (req, res) => {
  try {
    const clientId = req.params?.clientId;

    // Fetch all service requests by clientId and populate related fields
    const requests = await ServiceRequestModal.find({ clientId, ...req?.query })
      .populate("pmAssigned")
      .populate("smAssigned")
      .populate("quotation")
      .populate("clientUserId")
      .populate("branch_id")
      .populate("users")
      .populate("createdByservicePartnerUserId")
      .populate("createdByclientUserId")
      .sort({ createdAt: -1 });

    // console.log(requests, "requestsrequests");
    // Respond with the fetched data
    res.status(200).json({ data: requests });
  } catch (error) {
    // Handle errors
    res.status(500).json({
      message: "Error fetching Service Requests.",
      error: error.message,
    });
  }
};

const getAllRequests = async (req, res) => {
  try {
    // console.log(req.query, "req.query in getAllRequests");
    const requests = await ServiceRequestModal.find(req?.query)
      .populate(
        "pmAssigned smAssigned quotation branch_id users clientUserId createdByservicePartnerUserId"
      )
      .sort({ createdAt: -1 });
    res.status(200).json({ data: requests });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching Service Requests.",
      error: error.message,
    });
  }
};

const getSubordinates = async (req, res) => {
  try {
    const { user_id, clientId } = req.query;

    let clientQuery = {};
    if (clientId) {
      clientQuery = { clientId: new mongoose.Types.ObjectId(clientId) };
    }

    const result = await ClientUserModal.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(user_id),
          ...clientQuery,
        },
      },
      {
        $graphLookup: {
          from: "clientusers",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "reporting_to",
          as: "subordinates",
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          designation: 1,
          profileImage: 1,
          reporting_to: 1,
          subordinates: {
            $map: {
              input: "$subordinates",
              as: "sub",
              in: {
                _id: "$$sub._id",
                name: "$$sub.name",
                designation: "$$sub.designation",
                profileImage: "$$sub.profileImage",
                reporting_to: "$$sub.reporting_to",
              },
            },
          },
        },
      },
    ]);

    if (!result.length) {
      return res
        .status(404)
        .json({ error: "User not found or no subordinates." });
    }

    const [mainUser] = result;
    const allUsers = [mainUser, ...mainUser.subordinates];
    res.status(200).json(allUsers);
  } catch (error) {
    console.error("Error fetching subordinates:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get Service Request by ID
const getRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    const validation = validateObjectId(id, "ID");
    if (!validation.isValid) {
      return res.status(validation.error.statusCode).json({
        message: validation.error.message,
      });
    }

    const request = await ServiceRequestModal.findById(id)
      .populate("pmAssigned")
      .populate("smAssigned")
      .populate("clientId")
      .populate("servicePartnerId")
      .populate("branch_id")
      .populate("clientUserId")
      .populate("createdByservicePartnerUserId")
      .populate("createdByclientUserId")
      .populate({
        path: "ServiceTargetStatusLog",
        populate: { path: "user_id" },
      })
      .populate({
        path: "users",
        populate: [
          {
            path: "role",
          },
        ],
      })
      .populate({
        path: "quotation",
        populate: [
          {
            path: "rcs.rc_id",
            populate: {
              path: "inventory_id",
            },
          },
          {
            path: "non_rcs.inventory_id",
          },
          {
            path: "createdBy",
          },
        ],
      })

      .sort({ createdAt: -1 });

    if (!request) {
      return res.status(404).json({ message: "Service Request not found." });
    }
    res.status(200).json({ data: request });
  } catch (error) {
    console.error("Error fetching Service Request:", error);

    // Handle specific MongoDB errors
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid ID format. Please provide a valid ObjectId.",
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Error fetching Service Request.",
      error: error.message,
    });
  }
};

// Assign PM to a Service Request
const assignPm = async (req, res) => {
  try {
    const { id } = req.params;
    const { pmId } = req.body;

    // Validate ObjectId format
    const validation = validateObjectId(id, "Service Request ID");
    if (!validation.isValid) {
      return res.status(validation.error.statusCode).json({
        message: validation.error.message,
      });
    }

    // Fetch the service request and populate users' roles
    const serviceRequest = await ServiceRequestModal.findById(id).populate({
      path: "users",
      populate: { path: "role" },
    });

    if (!serviceRequest) {
      return res.status(404).json({ message: "Service Request not found." });
    }

    // Filter out users with role "Project Manager"
    const filteredUsers = serviceRequest.users
      .filter(
        (user) =>
          user.role?.name !== "Project Manager" &&
          user.role?.name !== "PROJECT MANAGER"
      )
      .map((user) => user._id);

    // console.log("Filtered Users (without Project Manager):", filteredUsers);

    // Add the new PM
    filteredUsers.push(pmId);

    // Update the service request
    serviceRequest.pmAssigned = pmId;
    serviceRequest.pmAssignedStatus = Status.ASSIGNED;
    serviceRequest.users = filteredUsers;
    await serviceRequest.save();

    res
      .status(200)
      .json({ message: "PM assigned successfully.", data: serviceRequest });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error assigning PM.", error: error.message });
  }
};

// Assign SM to a Service Request
const assignSm = async (req, res) => {
  try {
    const { id } = req.params;
    const { smId } = req.body;

    const serviceRequest = await ServiceRequestModal.findById(id).populate({
      path: "users",
      populate: { path: "role" },
    });

    if (!serviceRequest) {
      return res.status(404).json({ message: "Service Request not found." });
    }

    // Filter out users with role "Service Manager"
    const filteredUsers = serviceRequest.users
      .filter(
        (user) =>
          user.role?.name !== "Service Manager" &&
          user.role?.name !== "SERVICE MANAGER"
      )
      .map((user) => user._id);

    // console.log("Filtered Users (without Service Manager):", filteredUsers);

    // Add the new SM
    filteredUsers.push(smId);

    // Update the service request
    serviceRequest.smAssigned = smId;
    serviceRequest.smAssignedStatus = Status.ASSIGNED;
    serviceRequest.users = filteredUsers;
    await serviceRequest.save();

    res
      .status(200)
      .json({ message: "SM assigned successfully.", data: serviceRequest });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error assigning SM.", error: error.message });
  }
};

const assignToUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    const updatedRequest = await ServiceRequestModal.findByIdAndUpdate(
      id,
      { $push: { users: user_id } },
      { new: true }
    );

    if (!updatedRequest) {
      return res.status(404).json({ message: "Service Request not found." });
    }

    res
      .status(200)
      .json({ message: "User assigned successfully.", data: updatedRequest });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error assigning SM.", error: error.message });
  }
};

// Add or Update Quotation for a Service Request
const addOrUpdateQuotationForRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { quotationId } = req.body;

    const updatedRequest = await ServiceRequestModal.findByIdAndUpdate(
      id,
      {
        quotation: quotationId,
        quotationCreatedStatus: Status.ASSIGNED,
        quotationApprovalStatus: Status.APPROVAL_PENDING,
        quotationUpdatedAt: new Date(),
      },
      { new: true }
    );

    if (!updatedRequest) {
      return res.status(404).json({ message: "Service Request not found." });
    }

    res.status(200).json({
      message: "Quotation added/updated successfully.",
      data: updatedRequest,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error adding/updating quotation.",
      error: error.message,
    });
  }
};

const getServiceRequestDetails = async (req, res) => {
  try {
    const { serviceRequestId } = req.params;

    // Find the service request by ID
    let serviceRequest;

    const assigned = await AssignServiceModel.findOne({
      serviceId: serviceRequestId,
    })
      .populate({
        path: "serviceId",
        populate: {
          path: "pmAssigned smAssigned branch_id clientUserId",
        },
      })
      .populate("inventories.inventory_id")
      .sort({ createdAt: -1 });

    // console.log(assigned, "assignedassigned");

    if (assigned) {
      serviceRequest = assigned;
    } else {
      serviceRequest = await ServiceRequestModal.findById(serviceRequestId)

        .populate("pmAssigned")
        .populate("smAssigned")
        .populate("clientId")
        .populate("branch_id")
        .populate("clientUserId")
        .populate({
          path: "quotation",
          populate: [
            {
              path: "rcs.rc_id",
              populate: {
                path: "inventory_id",
              },
            },
            {
              path: "non_rcs.inventory_id",
            },
          ],
        })
        .sort({ createdAt: -1 });
    }

    // console.log(serviceRequest, "serviceRequestserviceRequest --------");

    if (!serviceRequest) {
      return res.status(404).json({ message: "Service Request not found" });
    }

    const areAllItemsCompleted =
      serviceRequest?.inventories?.every(
        (item) => item?.completionStatus === true
      ) || false;

    const lastIncompleteItem =
      serviceRequest?.inventories?.filter(
        (item) => item.completionStatus === false
      ) || [];

    const steps = [
      {
        step: "Service Request Raised",
        status: "Completed",
        description: `Service request logged by support desk on ${
          serviceRequest?.serviceCreatedDate
            ? new Date(serviceRequest.serviceCreatedDate).toLocaleString(
                "en-IN",
                {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                }
              )
            : "N/A"
        }`,
        timestamp: (serviceRequest?.serviceId || serviceRequest)?.createdAt,
        isCompleted: true,
      },
      {
        step: "Task Assigned to Project Manager",
        status:
          (serviceRequest?.serviceId || serviceRequest)?.pmAssignedStatus ===
          Status.PENDING
            ? "In Progress"
            : "Completed",
        description:
          (serviceRequest?.serviceId || serviceRequest)?.pmAssignedStatus ===
          Status.ASSIGNED
            ? `${serviceRequest?.pmAssigned?.name} Contact No. ${serviceRequest?.pmAssigned?.mobile}`
            : `Waiting for project manager to analyze the task.`,
        assignedTo: (serviceRequest?.serviceId || serviceRequest)?.pmAssigned
          ?.name,
        timestamp: (serviceRequest?.serviceId || serviceRequest)?.updatedAt,
        isCompleted:
          (serviceRequest?.serviceId || serviceRequest)?.pmAssignedStatus !==
          Status.PENDING,
      },
      {
        step: "Quote Submitted for the task",
        status:
          (serviceRequest?.serviceId || serviceRequest)
            ?.quotationCreatedStatus === Status.PENDING
            ? "In Progress"
            : (serviceRequest?.serviceId || serviceRequest)
                ?.quotationCreatedStatus === Status.ASSIGNED
            ? "Assigned"
            : "Completed",
        description:
          (serviceRequest?.serviceId || serviceRequest)
            ?.quotationCreatedStatus === Status.ASSIGNED
            ? `${
                serviceRequest?.quotation?.createdAt
                  ? new Date(serviceRequest.quotation.createdAt).toLocaleString(
                      "en-IN",
                      {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )
                  : "N/A"
              }`
            : "Waiting for service manager to prepare the quote of the task.",
        quotationId: serviceRequest.quotation,
        timestamp: (serviceRequest?.serviceId || serviceRequest)
          ?.quotationUpdatedAt,
        isCompleted:
          (serviceRequest?.serviceId || serviceRequest)
            ?.quotationCreatedStatus !== Status.PENDING,
        hasAction: true,
        actionLabel: "View Quote",
      },
      // Insert Quotation Approved step if quotationCreatedStatus is ASSIGNED
      ...((serviceRequest?.serviceId || serviceRequest)
        ?.quotationCreatedStatus === Status.ASSIGNED
        ? [
            {
              step: "Quotation Approved",
              status:
                (serviceRequest?.serviceId || serviceRequest)
                  ?.quotationApprovalStatus === Status.APPROVED
                  ? "Completed"
                  : "In Progress",
              description:
                (serviceRequest?.serviceId || serviceRequest)
                  ?.quotationApprovalStatus === Status.APPROVED
                  ? "Quotation has been approved."
                  : "Waiting for quotation approval.",
              timestamp: (serviceRequest?.serviceId || serviceRequest)
                ?.quotationUpdatedAt,
              isCompleted:
                (serviceRequest?.serviceId || serviceRequest)
                  ?.quotationApprovalStatus === Status.APPROVED,
            },
          ]
        : []),
      {
        step: "Task in Progress",
        status: areAllItemsCompleted ? "Completed" : "In Progress",
        description: areAllItemsCompleted
          ? `All tasks have been completed.`
          : lastIncompleteItem[0]?.inventory_id?.itemName
          ? `Working on  ${lastIncompleteItem[0]?.inventory_id?.itemName}`
          : "",
        timestamp: serviceRequest.updatedAt,
        isCompleted: areAllItemsCompleted,
        hasAction: true,
        actionLabel: "View Steps",
      },
      {
        step: "Task Completed",
        status:
          (serviceRequest?.serviceId || serviceRequest)
            ?.taskCompletionStatus === Status.COMPLETED
            ? "Completed"
            : "Waiting",
        description: areAllItemsCompleted
          ? ""
          : "Waiting for client to approve the task.",
        timestamp: (serviceRequest?.serviceId || serviceRequest)?.updatedAt,
        isCompleted: areAllItemsCompleted,
      },
    ];

    return res.status(200).json({ steps });
  } catch (error) {
    console.log(error, "Eroorrr");

    res
      .status(500)
      .json({ message: "Error Fetching Details", error: error.message });
  }
};

// Add after-images for a Service Request
const addAfterImagesForRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { afterImages } = req.body;

    // Ensure each image has the required fields
    const formattedImages = afterImages.map((image) => ({
      title: image.title || "",
      url: image.url,
      dateCreated: image.dateCreated || new Date(),
    }));

    const updatedRequest = await ServiceRequestModal.findByIdAndUpdate(
      id,
      { $push: { afterImages: { $each: formattedImages } } },
      { new: true }
    );

    if (!updatedRequest) {
      return res.status(404).json({ message: "Service Request not found." });
    }

    res.status(200).json({
      message: "After-images added successfully.",
      data: updatedRequest,
    });
  } catch (error) {
    console.log(error, "errorAfter");
    res
      .status(500)
      .json({ message: "Error adding after-images.", error: error.message });
  }
};
const addBeforeImagesForRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { beforeImages } = req.body;

    // Ensure each image has the required fields
    const formattedImages = beforeImages.map((image) => ({
      title: image.title || "",
      url: image.url,
      dateCreated: image.dateCreated || new Date(),
    }));

    const updatedRequest = await ServiceRequestModal.findByIdAndUpdate(
      id,
      { $push: { beforeImages: { $each: formattedImages } } },
      { new: true }
    );

    if (!updatedRequest) {
      return res.status(404).json({ message: "Service Request not found." });
    }

    res.status(200).json({
      message: "Before images added successfully.",
      data: updatedRequest,
    });
  } catch (error) {
    console.log(error, "errorBefore");

    res
      .status(500)
      .json({ message: "Error adding before-images.", error: error.message });
  }
};

// Function to update quotation approval status
const updateQuotationApprovalStatus = async (req, res) => {
  const { id } = req.params;
  const { status, approveQuotationDate } = req.body;

  if (!id || !Object.values(Status).includes(status)) {
    return res.status(400).json({ message: "Invalid request data" });
  }

  try {
    const serviceRequest = await ServiceRequestModal.findByIdAndUpdate(
      id,
      {
        quotationApprovalStatus: status,
        approveQuotationDate,
      },
      { new: true }
    );

    if (!serviceRequest) {
      return res.status(404).json({ message: "Service request not found" });
    }

    return res.status(200).json({ message: "Status Updated Succesfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error adding after-images.", error: error.message });
  }
};

const updateServiceTargetStatus = async (req, res) => {
  const { id } = req.params;
  let {
    status,
    ServiceTargetStatusDate,
    ServiceTargetStatusRemarks,
    userId,
    ServiceTargetDate,
    StartingTargetDate,
  } = req.body;
  // console.log(req.body, "req.body in updateServiceTargetStatus");
  // Prepare log entry
  const logEntry = {
    status,
    date: ServiceTargetStatusDate,
    remarks: ServiceTargetStatusRemarks,
    user_id: userId ? new mongoose.Types.ObjectId(userId) : null,
    targetDate: ServiceTargetDate,
    StartingTargetDate: StartingTargetDate,
  };

  try {
    // Prepare update object - only include fields that have values
    const updateObject = {
      $push: { ServiceTargetStatusLog: logEntry },
    };

    // Only update quotationApprovalStatus if status is provided
    if (status) {
      updateObject.quotationApprovalStatus = status;
    }

    const serviceRequest = await ServiceRequestModal.findByIdAndUpdate(
      id,
      updateObject,
      { new: true }
    );

    if (!serviceRequest) {
      return res.status(404).json({ message: "Service request not found" });
    }

    return res.status(200).json({
      message: "Status log updated successfully",
      data: serviceRequest,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error updating status log.", error: error.message });
  }
};

// Helper to build search query for all fields
function buildSearchQuery(query) {
  const search = query.search;
  if (!search) return {};

  const searchRegex = new RegExp(search, "i");
  return {
    $or: [
      { title: searchRegex },
      { description: searchRegex },
      { serviceNumber: searchRegex },
      { serviceType: searchRegex },
      { cost_name: searchRegex },
      { call_reference_number: searchRegex },
      { pmAssignedStatus: searchRegex },
      { smAssignedStatus: searchRegex },
      { quotationCreatedStatus: searchRegex },
      { quotationApprovalStatus: searchRegex },
      { taskCompletionStatus: searchRegex },
      // Add more fields as needed
    ],
  };
}

const getServiceRequestsByUserHierarchy = async (req, res) => {
  const { user_id, servicePartnerId, clientId } = req.query;

  try {
    const query = {};
    const searchQuery = buildSearchQuery(req.query);

    if (user_id) {
      const hierarchy = await ClientUserModal.aggregate([
        {
          $match: { _id: new mongoose.Types.ObjectId(user_id) },
        },
        {
          $graphLookup: {
            from: "clientusers",
            startWith: "$_id",
            connectFromField: "_id",
            connectToField: "reporting_to",
            as: "subordinates",
          },
        },
        {
          $project: {
            allUserIds: {
              $concatArrays: [["$_id"], "$subordinates._id"],
            },
          },
        },
      ]);

      const allUserIds = hierarchy?.[0]?.allUserIds || [];
      // console.log(allUserIds, "allUserIds");

      query.clientUserId = { $in: allUserIds };
    }

    if (servicePartnerId) {
      query.servicePartnerId = new mongoose.Types.ObjectId(servicePartnerId);
    }
    if (clientId) {
      query.clientId = new mongoose.Types.ObjectId(clientId);
    }

    const serviceRequests = await ServiceRequestModal.find({
      ...query,
      ...searchQuery,
    })
      .populate("clientId")
      .populate("clientUserId")
      .populate("servicePartnerId")
      .populate("pmAssigned")
      .populate("smAssigned")
      .populate("quotation")
      .populate("branch_id")
      .populate("users")
      .populate("createdByservicePartnerUserId")
      .populate("createdByclientUserId")
      .sort({ createdAt: -1 });

    return res.status(200).json(serviceRequests);
  } catch (error) {
    console.error("Error fetching service requests:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a single after-image for a Service Request
const deleteAfterImageForRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { afterImage } = req.body;
    // console.log(afterImage, "afterImage from frontend");

    // First find the document to inspect the actual afterImages
    const request = await ServiceRequestModal.findById(id);
    if (!request) {
      return res.status(404).json({ message: "Service Request not found." });
    }

    // Find the exact image in the array to get its exact representation
    const imageToDelete = request.afterImages.find((img) =>
      typeof afterImage === "string"
        ? img === afterImage || img.url === afterImage
        : img.url === afterImage.url
    );

    if (!imageToDelete) {
      return res.status(404).json({ message: "After-image not found." });
    }

    // Use the exact object from the database for pulling
    const updatedRequest = await ServiceRequestModal.findByIdAndUpdate(
      id,
      { $pull: { afterImages: imageToDelete } },
      { new: true }
    );

    res.status(200).json({
      message: "After-image deleted successfully.",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Error in deleteAfterImageForRequest:", error);
    res.status(500).json({
      message: "Error deleting after-image.",
      error: error.message,
    });
  }
};

// Delete a single before-image for a Service Request
const deleteBeforeImageForRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { beforeImage } = req.body;
    // console.log(beforeImage, "beforeImage from frontend");

    // First find the document to inspect the actual beforeImages
    const request = await ServiceRequestModal.findById(id);
    if (!request) {
      return res.status(404).json({ message: "Service Request not found." });
    }

    // Find the exact image in the array to get its exact representation
    const imageToDelete = request.beforeImages.find((img) =>
      typeof beforeImage === "string"
        ? img === beforeImage || img.url === beforeImage
        : img.url === beforeImage.url
    );

    if (!imageToDelete) {
      return res.status(404).json({ message: "Before-image not found." });
    }

    // Use the exact object from the database for pulling
    const updatedRequest = await ServiceRequestModal.findByIdAndUpdate(
      id,
      { $pull: { beforeImages: imageToDelete } },
      { new: true }
    );

    res.status(200).json({
      message: "Before-image deleted successfully.",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Error in deleteBeforeImageForRequest:", error);
    res.status(500).json({
      message: "Error deleting before-image.",
      error: error.message,
    });
  }
};

// Add team members to a Service Request
const addTeamMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { teamMembers } = req.body;

    // First fetch the service request and populate users
    const serviceRequest = await ServiceRequestModal.findById(id).populate({
      path: "users",
      populate: { path: "role" },
    });

    if (!serviceRequest) {
      return res.status(404).json({ message: "Service Request not found." });
    }

    // Replace the entire teamMembers and users arrays with new team members
    const updatedRequest = await ServiceRequestModal.findByIdAndUpdate(
      id,
      {
        $set: {
          teamMembers: teamMembers,
          users: teamMembers,
        },
      },
      { new: true }
    ).populate(["teamMembers", "users"]);

    res.status(200).json({
      message: "Team members updated successfully.",
      data: updatedRequest,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating team members.",
      error: error.message,
    });
  }
};

// Edit/Update a Service Request
const editServiceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate ObjectId format
    const validation = validateObjectId(id, "Service Request ID");
    if (!validation.isValid) {
      return res.status(validation.error.statusCode).json({
        message: validation.error.message,
      });
    }

    // Remove fields that shouldn't be updated directly
    delete updateData.serviceNumber;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const updatedRequest = await ServiceRequestModal.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate("clientId")
      .populate("clientUserId")
      .populate("servicePartnerId")
      .populate("pmAssigned")
      .populate("smAssigned")
      .populate("quotation")
      .populate("branch_id")
      .populate("users")
      .populate("teamMembers")
      .populate("createdByservicePartnerUserId")
      .populate("createdByclientUserId");

    if (!updatedRequest) {
      return res.status(404).json({ message: "Service Request not found." });
    }

    res.status(200).json({
      message: "Service Request updated successfully.",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Error updating service request:", error);
    res.status(500).json({
      message: "Error updating Service Request.",
      error: error.message,
    });
  }
};

// Delete a Service Request
const deleteServiceRequest = async (req, res) => {
  try {
    const { id } = req.params;

    // First check if the service request exists
    const serviceRequest = await ServiceRequestModal.findById(id);
    if (!serviceRequest) {
      return res.status(404).json({ message: "Service Request not found." });
    }

    // Check if there are any associated assign services
    const assignedServices = await AssignServiceModel.find({ serviceId: id });

    // If there are assigned services, we might want to delete them too or prevent deletion
    if (assignedServices.length > 0) {
      // Option 1: Prevent deletion if there are assigned services
      return res.status(400).json({
        message:
          "Cannot delete Service Request. It has associated assigned services.",
        assignedServicesCount: assignedServices.length,
      });

      // Option 2: Delete associated assigned services (uncomment if needed)
      // await AssignServiceModel.deleteMany({ serviceId: id });
    }

    // Delete the service request
    const deletedRequest = await ServiceRequestModal.findByIdAndDelete(id);

    res.status(200).json({
      message: "Service Request deleted successfully.",
      data: deletedRequest,
    });
  } catch (error) {
    console.error("Error deleting service request:", error);
    res.status(500).json({
      message: "Error deleting Service Request.",
      error: error.message,
    });
  }
};

// Add to module exports
module.exports = {
  createRequest,
  getAllRequests,
  getRequestById,
  assignPm,
  assignSm,
  addOrUpdateQuotationForRequest,
  addAfterImagesForRequest,
  getServiceRequestDetails,
  updateQuotationApprovalStatus,
  getServiceRequestsByServicePartnerId,
  getServiceRequestsByClientId,
  assignToUser,
  addBeforeImagesForRequest,
  getSubordinates,
  getServiceRequestsByUserHierarchy,
  deleteAfterImageForRequest,
  deleteBeforeImageForRequest,
  addTeamMembers,
  updateServiceTargetStatus,
  editServiceRequest,
  deleteServiceRequest,
};
