const express = require("express");
const router = express.Router();
const {
  createClient,
  getAllClients,
  updateClient,
  deleteClient,
  getClientById,
} = require("./client-controller");

router.post("/create-client", createClient);

router.get("/get-All-client", getAllClients);
router.get("/get-client-by-id/:id", getClientById);

router.post("/update-client/:id", updateClient);

router.delete("/delete-client/:id", deleteClient);

module.exports = router;
