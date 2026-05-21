const { checkIfNumberEmailUnique } = require("../../utils/helpers");
const { ClientUserModal } = require("../client-user/clientUser-modal");
const { ClientModel } = require("./client-model");

// Create a new client
async function createClient(req, res) {
  if (req?.body?.mobile || req?.body?.email) {
    const is_unique = await checkIfNumberEmailUnique(
      req?.body?.mobile,
      req?.body?.email
    );

    if (!is_unique?.success && is_unique?.error) {
      return res.status(400).json({ message: is_unique?.error });
    }
  }
  const client = new ClientModel(req.body);
  try {
    const savedClient = await client.save();
    res.status(201).json(savedClient);
  } catch (error) {
    res.status(400).json({ message: error.message, error: error.message });
  }
}

async function getAllClients(req, res) {
  try {
    // Fetch all clients
    const clients = await ClientModel.find().sort({ createdAt: -1 });

    // Fetch all admin users related to these clients
    const adminUsers = await ClientUserModal.find({
      user_type: "admin",
    }).populate("clientId");
    // Map admin users to their respective clients
    const clientsWithAdmins = clients.map((client) => {
      const admin = adminUsers.find(
        (user) => String(user.clientId?._id) === String(client._id)
      );
      return {
        ...client.toObject(),
        admin: admin || null, // Include admin details if available
      };
    });

    res.status(200).json(clientsWithAdmins);
  } catch (error) {
    res.status(500).json({ message: error.message, error: error.message });
  }
}

// Update a client by ID
async function updateClient(req, res) {
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
    const updatedClient = await ClientModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).sort({ createdAt: -1 });
    res.status(200).json(updatedClient);
  } catch (error) {
    res.status(400).json({ message: error.message, error: error.message });
  }
}

// Delete a client by ID
async function deleteClient(req, res) {
  try {
    await ClientModel.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message, error: error.message });
  }
}

// Get a client by ID
async function getClientById(req, res) {
  try {
    const client = await ClientModel.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    res.status(200).json(client);
  } catch (error) {
    res.status(500).json({ message: error.message, error: error.message });
  }
}

// ... existing code ...

module.exports = {
  createClient,
  getAllClients,
  updateClient,
  deleteClient,
  getClientById,
};
