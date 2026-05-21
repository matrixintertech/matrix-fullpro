const { Pay } = require("twilio/lib/twiml/VoiceResponse");
const { PaymentModel } = require("../payments/payment-model");
const { ExpenseModel, Status } = require("./expense-model");
const {
  ServiceRequestModal,
} = require("../serviceRequests/service-request-model");
const VendorPayment = require("../vendor-payment/vendor-payment-model");
const InventoryModel = require("../inventory/inventory-model");
const { default: mongoose } = require("mongoose");

// Helper function to generate ExpenseId
async function generateExpenseId(serviceRequestId) {
  try {
    // First populate the serviceRequest to get serviceNumber
    const serviceRequest = await mongoose
      .model("ServiceRequest")
      .findById(serviceRequestId);
    if (!serviceRequest) {
      throw new Error("Service request not found");
    }

    const serviceNumber = serviceRequest.serviceNumber;

    // Find all expenses with expenseId to get the globally highest sequence number
    const allExpenses = await ExpenseModel.find({
      expenseId: { $exists: true, $ne: null },
    }).select("expenseId");

    let maxSequenceNumber = 0;

    // Iterate through all expenses to find the highest sequence number
    allExpenses.forEach((expense) => {
      const expenseId = expense.expenseId;
      if (expenseId && typeof expenseId === "string") {
        // Expected format: "Expense-{serviceNumber}-{sequenceNumber}"
        const parts = expenseId.split("-");
        if (parts.length >= 3) {
          const sequenceStr = parts[parts.length - 1];
          const sequenceNum = parseInt(sequenceStr, 10);
          if (!isNaN(sequenceNum) && sequenceNum > maxSequenceNumber) {
            maxSequenceNumber = sequenceNum;
          }
        }
      }
    });

    // Next sequence number will be maxSequenceNumber + 1
    const nextSequenceNumber = maxSequenceNumber + 1;

    // Format sequence number with leading zeros (5 digits)
    const formattedSequence = nextSequenceNumber.toString().padStart(5, "0");

    return `Expense-${serviceNumber}-${formattedSequence}`;
  } catch (error) {
    console.error("Error generating ExpenseId:", error);
    throw error;
  }
}

// Helper function to normalize file data
function normalizeFiles(file, files) {
  const fileList = [];

  // Add single file if provided (for backward compatibility)
  if (file && typeof file === "string" && file.trim() !== "") {
    fileList.push(file.trim());
  }

  // Add multiple files if provided
  if (files && Array.isArray(files)) {
    files.forEach((f) => {
      if (
        f &&
        typeof f === "string" &&
        f.trim() !== "" &&
        !fileList.includes(f.trim())
      ) {
        fileList.push(f.trim());
      }
    });
  }

  return fileList;
}

// Helper function to normalize expense data for response (ensures files array is always present)
function normalizeExpenseForResponse(expense) {
  if (!expense) return expense;

  // Convert to plain object if it's a Mongoose document
  const expenseObj = expense.toObject ? expense.toObject() : expense;

  // Normalize files - ensure files array is always present
  const normalizedFiles = normalizeFiles(expenseObj.file, expenseObj.files);
  expenseObj.files = normalizedFiles;

  // Keep file field for backward compatibility if only one file
  if (normalizedFiles.length === 1) {
    expenseObj.file = normalizedFiles[0];
  } else if (normalizedFiles.length === 0) {
    expenseObj.file = null;
  }

  return expenseObj;
}

// Create a new expense
async function createExpense(req, res) {
  try {
    let expenseData = { ...req.body };

    // Normalize file data - support both single file and multiple files
    const normalizedFiles = normalizeFiles(req.body.file, req.body.files);

    // Set files array (will be handled by pre-save hook for backward compatibility)
    if (normalizedFiles.length > 0) {
      expenseData.files = normalizedFiles;
      // Keep single file for backward compatibility if only one file
      if (normalizedFiles.length === 1) {
        expenseData.file = normalizedFiles[0];
      }
    }

    // Generate expenseId if not provided
    if (!req.body.expenseId) {
      if (!req.body.serviceRequestId) {
        return res.status(400).json({
          message: "serviceRequestId is required for expense creation",
        });
      }
      expenseData.expenseId = await generateExpenseId(
        req.body.serviceRequestId
      );
    }

    // Normalize `file` field to always be an array when present
    if (expenseData.file && !Array.isArray(expenseData.file)) {
      expenseData.file = [expenseData.file];
    }

    const expense = new ExpenseModel(expenseData);
    await expense.save();

    // Normalize expense data for response
    const normalizedExpense = normalizeExpenseForResponse(expense);

    res.status(201).json({
      message: "Expense Created Successfully",
      expenseId: normalizedExpense.expenseId,
      files: normalizedExpense.files,
    });
  } catch (error) {
    console.log(error, "errrrrr");
    res
      .status(400)
      .json({ message: "Error Creating Expense", error: error.message });
  }
}

async function getExpenseByServiceId(req, res) {
  try {
    const expenses = await ExpenseModel.find({
      serviceRequestId: req?.params?.serviceId,
    })
      .populate(["serviceRequestId", "user_id", "action_taken_by"])
      .sort({ createdAt: -1 });

    // Normalize file data for all expenses
    const normalizedExpenses = expenses.map((expense) =>
      normalizeExpenseForResponse(expense)
    );

    res.json(normalizedExpenses);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error Getting Expenses", error: error.message });
  }
}
async function getExpensesByQuery(req, res) {
  try {
    const query = { ...req.query };

    if (Array.isArray(query.serviceRequestId)) {
      query.serviceRequestId = { $in: query.serviceRequestId };
    }

    const expenses = await ExpenseModel.find(query)
      .populate(["serviceRequestId", "user_id", "action_taken_by"])
      .populate("vendorId", "name")
      .sort({ createdAt: -1 });

    // Normalize file data for all expenses
    const normalizedExpenses = expenses.map((expense) =>
      normalizeExpenseForResponse(expense)
    );

    res.json(normalizedExpenses);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error Getting Expenses", error: error.message });
  }
}

// Update expense status
async function updateExpenseStatus(req, res) {
  try {
    const { expenseStatus, action_taken_by, approved_amount, file, files } =
      req.body;

    // Validate expenseStatus against Status constants (if provided)
    if (expenseStatus && !Object.values(Status).includes(expenseStatus)) {
      return res.status(400).json({ message: "Invalid expense status" });
    }

    // Get the current expense to check if expenseId exists
    const currentExpense = await ExpenseModel.findById(req.params.id);
    if (!currentExpense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // Prepare update data
    const updateData = {};
    if (expenseStatus) updateData.expenseStatus = expenseStatus;
    if (action_taken_by !== undefined)
      updateData.action_taken_by = action_taken_by;
    if (approved_amount !== undefined)
      updateData.approved_amount = approved_amount;

    // Handle file updates if provided
    if (file !== undefined || files !== undefined) {
      const normalizedFiles = normalizeFiles(file, files);
      if (normalizedFiles.length > 0) {
        updateData.files = normalizedFiles;
        // Keep single file for backward compatibility if only one file
        if (normalizedFiles.length === 1) {
          updateData.file = normalizedFiles[0];
        }
      }
    }

    // Generate expenseId if not present
    if (!currentExpense.expenseId) {
      if (!currentExpense.serviceRequestId) {
        return res.status(400).json({
          message: "serviceRequestId is required for expense ID generation",
        });
      }
      updateData.expenseId = await generateExpenseId(
        currentExpense.serviceRequestId
      );
    }

    const updatedExpense = await ExpenseModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    // Normalize expense data for response
    const normalizedExpense = normalizeExpenseForResponse(updatedExpense);

    res.json({
      message: "Expense Updated Successfully",
      expenseId: normalizedExpense.expenseId,
      files: normalizedExpense.files,
    });
  } catch (error) {
    console.log(error, "errrrrr");
    res
      .status(400)
      .json({ message: "Error Updating expense", error: error.message });
  }
}

// Delete expense
async function deleteExpense(req, res) {
  try {
    const deletedExpense = await ExpenseModel.findByIdAndDelete(req.params.id);
    if (!deletedExpense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.json({
      message: "Expense deleted successfully",
      deletedExpense: deletedExpense,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting expense",
      error: error.message,
    });
  }
}

// Redesigned getLedger API for better reliability and clarity
const getLedger = async (req, res) => {
  try {
    // Merge query params and body params (query takes precedence)
    const params = { ...req.body, ...req.query };

    const {
      from_date,
      to_date,
      serviceRequestId,
      servicePartnerId,
      user_id,
      vendorId,
      type,
      isVendor: isVendorParam,
    } = params;

    // Convert isVendor to boolean properly
    const isVendor =
      isVendorParam === true ||
      isVendorParam === "true" ||
      isVendorParam === 1 ||
      isVendorParam === "1";

    // Build serviceRequest filter
    let serviceRequestIds = [];
    if (servicePartnerId) {
      const serviceRequests = await ServiceRequestModal.find({
        servicePartnerId,
      }).select("_id");
      serviceRequestIds = serviceRequests.map(
        (sr) => new mongoose.Types.ObjectId(sr._id)
      );
    }

    if (serviceRequestId) {
      // Handle both single ID and array of IDs
      let requestIds = Array.isArray(serviceRequestId)
        ? serviceRequestId
        : [serviceRequestId];

      // Convert string IDs to ObjectIds
      const objectIds = requestIds.map((id) => new mongoose.Types.ObjectId(id));

      if (serviceRequestIds.length > 0) {
        // Filter to only include IDs that exist in servicePartnerId filter
        serviceRequestIds = serviceRequestIds.filter((id) =>
          objectIds.some((objId) => objId.toString() === id.toString())
        );

        if (serviceRequestIds.length === 0) {
          return res.json({
            success: true,
            openingBalance: 0,
            closingBalance: 0,
            ledger: [],
          });
        }
      } else {
        serviceRequestIds = objectIds;
      }
    }

    // Build date filter (on createdAt)
    const dateFilter = {};
    if (from_date) dateFilter.$gte = new Date(from_date);
    if (to_date) dateFilter.$lte = new Date(to_date);

    // Build main query filter
    const mainFilter = {};
    if (Object.keys(dateFilter).length > 0) mainFilter.createdAt = dateFilter;
    if (user_id) mainFilter.user_id = new mongoose.Types.ObjectId(user_id);
    if (vendorId && serviceRequestIds.length > 0) {
      mainFilter.serviceRequestId = { $in: serviceRequestIds };
    } else if (serviceRequestIds.length > 0) {
      mainFilter.serviceRequestId = { $in: serviceRequestIds };
    }

    // Calculate opening balance (all credits - debits before from_date)
    let openingBalance = 0;
    if (from_date) {
      const beforeFilter = {
        createdAt: { $lt: new Date(from_date) },
      };
      if (user_id) beforeFilter.user_id = new mongoose.Types.ObjectId(user_id);

      // Add serviceRequestId filter only for non-vendor mode
      if (!isVendor && serviceRequestIds.length > 0) {
        beforeFilter.serviceRequestId = { $in: serviceRequestIds };
      }

      let creditsBefore, debitsBefore;
      if (isVendor) {
        // Vendor mode - use VendorPayment for credits
        const vendorFilter = {};
        if (vendorId) {
          vendorFilter.vendor = new mongoose.Types.ObjectId(vendorId);
        }

        creditsBefore = await VendorPayment.find({
          ...beforeFilter,
          ...vendorFilter,
          status: "Paid",
        }).lean();

        // For expenses, show only those with vendorId field
        const expenseFilter = { vendorId: { $exists: true, $ne: null } };
        if (vendorId) {
          expenseFilter.vendorId = new mongoose.Types.ObjectId(vendorId);
        }

        debitsBefore = await ExpenseModel.find({
          ...beforeFilter,
          ...expenseFilter,
          expenseStatus: "Approved",
        }).lean();

        // Get inventory entries (inventory_in) as debits
        const inventoryBeforeFilter = {
          ...beforeFilter,
          record_type: "inventory_in",
        };
        // Map serviceRequestId to service_request field for inventory
        if (beforeFilter.serviceRequestId) {
          inventoryBeforeFilter.service_request = beforeFilter.serviceRequestId;
          delete inventoryBeforeFilter.serviceRequestId;
        }
        if (vendorId) {
          inventoryBeforeFilter.supplier_id = new mongoose.Types.ObjectId(
            vendorId
          );
        }
        const inventoryBefore = await InventoryModel.find(
          inventoryBeforeFilter
        ).lean();

        // Calculate total from inventory items
        const inventoryTotal = inventoryBefore.reduce((sum, inv) => {
          const itemsTotal = (inv.items || []).reduce((itemSum, item) => {
            const qty = item.qty_in || 0;
            const rate = item.rate || 0;
            return itemSum + qty * rate;
          }, 0);
          return sum + itemsTotal;
        }, 0);

        debitsBefore = [
          ...debitsBefore,
          ...inventoryBefore.map((inv) => ({
            ...inv,
            amount: (inv.items || []).reduce((sum, item) => {
              const qty = item.qty_in || 0;
              const rate = item.rate || 0;
              return sum + qty * rate;
            }, 0),
          })),
        ];
      } else {
        // Regular mode - use PaymentModel for credits
        creditsBefore = await PaymentModel.find({
          ...beforeFilter,
          paymentStatus: "Paid",
        }).lean();
        debitsBefore = await ExpenseModel.find({
          ...beforeFilter,
          expenseStatus: "Approved",
        }).lean();

        // Get inventory entries (inventory_in) as debits
        const inventoryBeforeFilter = {
          ...beforeFilter,
          record_type: "inventory_in",
        };
        // Map serviceRequestId to service_request field for inventory
        if (beforeFilter.serviceRequestId) {
          inventoryBeforeFilter.service_request = beforeFilter.serviceRequestId;
          delete inventoryBeforeFilter.serviceRequestId;
        }
        const inventoryBefore = await InventoryModel.find(
          inventoryBeforeFilter
        ).lean();

        debitsBefore = [
          ...debitsBefore,
          ...inventoryBefore.map((inv) => ({
            ...inv,
            amount: (inv.items || []).reduce((sum, item) => {
              const qty = item.qty_in || 0;
              const rate = item.rate || 0;
              return sum + qty * rate;
            }, 0),
          })),
        ];
      }
      const creditTotal = creditsBefore.reduce(
        (sum, c) => sum + (c.approved_amount ?? c.amount ?? 0),
        0
      );
      const debitTotal = debitsBefore.reduce(
        (sum, d) => sum + (d.approved_amount ?? d.amount ?? 0),
        0
      );
      openingBalance = parseFloat((creditTotal - debitTotal).toFixed(2));
    }

    // Fetch credits (payments)
    let creditEntries = [];
    let debitEntries = [];

    if (!type || type === "Credit") {
      let credits;
      if (isVendor) {
        // Vendor mode - use VendorPayment for credits
        const vendorFilter = {};
        if (vendorId) {
          vendorFilter.vendor = new mongoose.Types.ObjectId(vendorId);
        }

        credits = await VendorPayment.find({
          ...mainFilter,
          ...vendorFilter,
          status: "Paid",
        })
          .populate("requestedBy")
          .populate("approved_by")
          .populate("mark_as_paid_by")
          .populate("po")
          .populate("serviceRequestId")
          .populate("vendor")
          .lean();

        creditEntries = credits.map((item) => ({
          date: item.requestedAt || item.createdAt,
          type: "Credit",
          status: item.status,
          user_id: item.requestedBy,
          approved_by: item.approved_by,
          mark_as_paid_by: item.mark_as_paid_by,
          po: item.po,
          vendorId: item.vendor,
          serviceRequestId: item.serviceRequestId,
          amount: parseFloat(
            (item.approved_amount ?? item.amount ?? 0).toFixed(2)
          ),
          desc: item.remarks,
          _id: item._id,
        }));
      } else {
        // Regular mode - use PaymentModel for credits
        credits = await PaymentModel.find({
          ...mainFilter,
          paymentStatus: "Paid",
        })
          .populate("user_id")
          .populate("approved_by")
          .populate("mark_as_paid_by")
          .populate("serviceRequestId")
          .lean();
        creditEntries = credits.map((item) => ({
          date: item.createdAt,
          type: "Credit",
          status: item.paymentStatus,
          user_id: item.user_id,
          approved_by: item.approved_by,
          mark_as_paid_by: item.mark_as_paid_by,
          serviceRequestId: item.serviceRequestId,
          amount: parseFloat(
            (item.approved_amount ?? item.amount ?? 0).toFixed(2)
          ),
          desc: item.desc,
          _id: item._id,
        }));
      }
    }

    if (!type || type === "Debit") {
      let debits;
      if (isVendor) {
        // Vendor mode - show expenses with vendorId field (non-empty)
        const expenseFilter = { vendorId: { $exists: true, $ne: null } };
        if (vendorId) {
          expenseFilter.vendorId = new mongoose.Types.ObjectId(vendorId);
        }

        debits = await ExpenseModel.find({
          ...mainFilter,
          ...expenseFilter,
          expenseStatus: "Approved",
        })
          .populate("user_id")
          .populate("action_taken_by")
          .populate("serviceRequestId")
          .populate({
            path: "vendorId",
            model: "Supplier",
          })
          .lean();

        // Get inventory entries (inventory_in) as debits
        const inventoryFilter = {
          record_type: "inventory_in",
        };
        // Map mainFilter to inventory fields
        if (mainFilter.createdAt) {
          inventoryFilter.createdAt = mainFilter.createdAt;
        }
        if (mainFilter.serviceRequestId) {
          inventoryFilter.service_request = mainFilter.serviceRequestId;
        }
        if (vendorId) {
          inventoryFilter.supplier_id = new mongoose.Types.ObjectId(vendorId);
        }

        const inventoryDebits = await InventoryModel.find(inventoryFilter)
          .populate("service_request")
          .populate("supplier_id")
          .populate("received_by")
          .lean();

        // Map expenses to debit entries
        debitEntries = debits.map((item) => ({
          date: item.createdAt,
          type: "Debit",
          status: item.expenseStatus,
          user_id: item.user_id,
          action_taken_by: item.action_taken_by,
          serviceRequestId: item.serviceRequestId,
          vendorId: item.vendorId,
          amount: parseFloat(
            (item.approved_amount ?? item.amount ?? 0).toFixed(2)
          ),
          desc: item.desc,
          _id: item._id,
        }));

        // Map inventory entries to debit entries
        const inventoryDebitEntries = inventoryDebits.map((item) => {
          const totalAmount = (item.items || []).reduce((sum, invItem) => {
            const qty = invItem.qty_in || 0;
            const rate = invItem.rate || 0;
            return sum + qty * rate;
          }, 0);

          return {
            date: item.createdAt,
            type: "Debit",
            status: "Inventory Purchase",
            user_id: item.received_by,
            action_taken_by: item.received_by,
            serviceRequestId: item.service_request,
            vendorId: item.supplier_id,
            amount: parseFloat(totalAmount.toFixed(2)),
            desc: `Inventory Purchase - ${item.bill_no || "N/A"}`,
            _id: item._id,
            isInventory: true,
          };
        });

        debitEntries = [...debitEntries, ...inventoryDebitEntries];
      } else {
        // Regular mode - get all approved expenses
        debits = await ExpenseModel.find({
          ...mainFilter,
          expenseStatus: "Approved",
        })
          .populate("user_id")
          .populate("action_taken_by")
          .populate("serviceRequestId")
          .lean();

        // Get inventory entries (inventory_in) as debits
        const inventoryFilter = {
          record_type: "inventory_in",
        };
        // Map mainFilter to inventory fields
        if (mainFilter.createdAt) {
          inventoryFilter.createdAt = mainFilter.createdAt;
        }
        if (mainFilter.serviceRequestId) {
          inventoryFilter.service_request = mainFilter.serviceRequestId;
        }

        const inventoryDebits = await InventoryModel.find(inventoryFilter)
          .populate("service_request")
          .populate("supplier_id")
          .populate("received_by")
          .lean();

        // Map expenses to debit entries
        debitEntries = debits.map((item) => ({
          date: item.createdAt,
          type: "Debit",
          status: item.expenseStatus,
          user_id: item.user_id,
          action_taken_by: item.action_taken_by,
          serviceRequestId: item.serviceRequestId,
          amount: parseFloat(
            (item.approved_amount ?? item.amount ?? 0).toFixed(2)
          ),
          desc: item.desc,
          _id: item._id,
        }));

        // Map inventory entries to debit entries
        const inventoryDebitEntries = inventoryDebits.map((item) => {
          const totalAmount = (item.items || []).reduce((sum, invItem) => {
            const qty = invItem.qty_in || 0;
            const rate = invItem.rate || 0;
            return sum + qty * rate;
          }, 0);

          return {
            date: item.createdAt,
            type: "Debit",
            status: "Inventory Purchase",
            user_id: item.received_by,
            action_taken_by: item.received_by,
            serviceRequestId: item.service_request,
            amount: parseFloat(totalAmount.toFixed(2)),
            desc: `Inventory Purchase - ${item.bill_no || "N/A"}`,
            _id: item._id,
            isInventory: true,
          };
        });

        debitEntries = [...debitEntries, ...inventoryDebitEntries];
      }
    }

    // Combine and sort all entries by date (newest first)
    let allEntries = [];
    if (type === "Credit") {
      allEntries = creditEntries;
    } else if (type === "Debit") {
      allEntries = debitEntries;
    } else {
      allEntries = [...creditEntries, ...debitEntries];
    }
    allEntries = allEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate closing balance first
    const closingBalance = allEntries.reduce((balance, entry) => {
      if (entry.type === "Credit") {
        return balance + entry.amount;
      } else if (entry.type === "Debit") {
        return balance - entry.amount;
      }
      return balance;
    }, openingBalance);

    // Add running balance in reverse order (newest first)
    // Work backwards from closing balance
    let runningBalance = closingBalance;
    const ledger = allEntries.map((entry, i) => {
      // For reverse order: show balance after this transaction
      // Start with closing balance and subtract each transaction going backwards
      const balanceAfter = runningBalance;

      // Update running balance for next iteration (going backwards)
      if (entry.type === "Credit") {
        runningBalance = runningBalance - entry.amount;
      } else if (entry.type === "Debit") {
        runningBalance = runningBalance + entry.amount;
      }

      return {
        ...entry,
        balanceAfter: parseFloat(balanceAfter.toFixed(2)),
        serial: i + 1,
      };
    });

    return res.json({
      success: true,
      openingBalance,
      closingBalance: parseFloat(closingBalance.toFixed(2)),
      ledger,
    });
  } catch (err) {
    console.error("Ledger API error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Get the last ExpenseId
async function getLastExpenseId(req, res) {
  try {
    const { serviceRequestId } = req.params;

    if (serviceRequestId) {
      // Get last ExpenseId for specific service request
      const serviceRequest = await mongoose
        .model("ServiceRequest")
        .findById(serviceRequestId);

      if (!serviceRequest) {
        return res.status(404).json({ message: "Service request not found" });
      }

      const serviceNumber = serviceRequest.serviceNumber;

      // Find expenses for this service request with ExpenseId pattern
      const expenses = await ExpenseModel.find({
        serviceRequestId: serviceRequestId,
        expenseId: {
          $exists: true,
          $ne: null,
          $regex: `^Expense-${serviceNumber}-`,
        },
      })
        .select("expenseId")
        .sort({ expenseId: -1 })
        .limit(1);

      if (expenses.length > 0) {
        return res.json({ lastExpenseId: expenses[0].expenseId });
      } else {
        // Generate the first ExpenseId for this service request
        const firstExpenseId = `Expense-${serviceNumber}-00001`;
        return res.json({ lastExpenseId: firstExpenseId });
      }
    } else {
      // Get overall last ExpenseId
      const expenses = await ExpenseModel.find({
        expenseId: { $exists: true, $ne: null },
      })
        .select("expenseId")
        .lean();

      let maxSequenceNumber = 0;
      let lastExpenseId = null;

      expenses.forEach((expense) => {
        const expenseId = expense.expenseId;
        if (expenseId && typeof expenseId === "string") {
          const parts = expenseId.split("-");
          if (parts.length >= 3) {
            const sequenceStr = parts[parts.length - 1];
            const sequenceNum = parseInt(sequenceStr, 10);
            if (!isNaN(sequenceNum) && sequenceNum > maxSequenceNumber) {
              maxSequenceNumber = sequenceNum;
              lastExpenseId = expenseId;
            }
          }
        }
      });

      if (lastExpenseId) {
        res.json({ lastExpenseId });
      } else {
        res.json({ lastExpenseId: null, message: "No expenses found" });
      }
    }
  } catch (error) {
    console.error("Error getting last ExpenseId:", error);
    res.status(500).json({
      message: "Error getting last ExpenseId",
      error: error.message,
    });
  }
}

module.exports = {
  createExpense,
  getExpenseByServiceId,
  getExpensesByQuery,
  updateExpenseStatus,
  deleteExpense,
  getLedger,
  getLastExpenseId, // Add the new function to exports
};
