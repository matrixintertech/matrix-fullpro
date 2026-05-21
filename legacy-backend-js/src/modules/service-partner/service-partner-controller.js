const { checkIfNumberEmailUnique } = require("../../utils/helpers");
const { UserModal } = require("../user/user-modal");
const { ServicePartnerModel } = require("./service-partner-model");

// Create a new servicePartner
async function createServicePartner(req, res) {
  const { name, mobile, email } = req.body;

  const is_unique = await checkIfNumberEmailUnique(mobile, email);

  if (!is_unique?.success && is_unique?.error) {
    return res.status(400).json({ message: is_unique?.error });
  }

  const servicePartner = new ServicePartnerModel(req.body);
  try {
    const savedServicePartner = await servicePartner.save();
    const newUser = new UserModal({
      name,
      mobile,
      email,
      userType: "admin",
      servicePartnerId: savedServicePartner?._id,
    });
    await newUser.save();
    res.status(201).json(savedServicePartner);
  } catch (error) {
    res.status(400).json({ message: error.message, error: error.message });
  }
}

async function getAllServicePartners(req, res) {
  try {
    // Fetch all servicePartners
    const servicePartners = await ServicePartnerModel.find().sort({
      createdAt: -1,
    });

    // Fetch all admin users related to these servicePartners
    const adminUsers = await UserModal.find({
      userType: "admin",
    }).populate("servicePartnerId");

    // Map admin users to their respective servicePartners
    const servicePartnersWithAdmins = servicePartners.map((servicePartner) => {
      const admin = adminUsers.find(
        (user) =>
          String(user.servicePartnerId?._id) === String(servicePartner._id)
      );
      return {
        ...servicePartner.toObject(),
        admin: admin || null, // Include admin details if available
      };
    });

    res.status(200).json(servicePartnersWithAdmins);
  } catch (error) {
    res.status(500).json({ message: error.message, error: error.message });
  }
}

// Update a servicePartner by ID
async function updateServicePartner(req, res) {
  try {
    if (req?.body?.mobile || req?.body?.email) {
      const is_unique = await checkIfNumberEmailUnique(
        req?.body?.mobile,
        req?.body?.email,
        req?.params?.id
      );

      if (!is_unique?.success && is_unique?.error) {
        return res.status(400).json({ message: is_unique?.error });
      }
    }
    const updatedServicePartner = await ServicePartnerModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).sort({ createdAt: -1 });

    res.status(200).json(updatedServicePartner);
  } catch (error) {
    res.status(400).json({ message: error.message, error: error.message });
  }
}

// Delete a servicePartner by ID
async function deleteServicePartner(req, res) {
  try {
    await ServicePartnerModel.findByIdAndDelete(req.params.id);
    await UserModal.findOneAndDelete({ servicePartnerId: req.params.id });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message, error: error.message });
  }
}

// Get a servicePartner by ID
async function getServicePartnerById(req, res) {
  try {
    const servicePartner = await ServicePartnerModel.findById(req.params.id);
    if (!servicePartner) {
      return res.status(404).json({ message: "ServicePartner not found" });
    }
    res.status(200).json(servicePartner);
  } catch (error) {
    res.status(500).json({ message: error.message, error: error.message });
  }
}

// ... existing code ...

module.exports = {
  createServicePartner,
  getAllServicePartners,
  updateServicePartner,
  deleteServicePartner,
  getServicePartnerById,
};
