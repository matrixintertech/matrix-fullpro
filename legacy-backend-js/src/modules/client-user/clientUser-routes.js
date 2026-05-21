const express = require("express");
const router = express.Router();

const {
  createClientUser,
  getAllClientUsers,
  getClientUserById,
  updateClientUser,
  deleteClientUser,
  getClientUserByClientId,
  getUsersByQuery,
  getClientUserByClientIdWithoutAdmin,
  getClientUsersForServicePartner,
} = require("./clientUser-controller");
const {
  getSubordinates,
} = require("../serviceRequests/service-request-controller");

router.post("/create-client-user", createClientUser);
router.post("/get-client-users-by-query", getUsersByQuery);
router.get(
  "/get-client-users-for-service-partner",
  getClientUsersForServicePartner
);
router.get("/get-all-client-user", getAllClientUsers);
router.get("/get-client-user-by-id/:id", getClientUserById);
router.get("/get-client-user-by-clientid/:id", getClientUserByClientId);
router.get("/get-user-subtree", getSubordinates);
router.get(
  "/get-client-user-by-clientid-without-admin/:id",
  getClientUserByClientIdWithoutAdmin
);

router.post("/update-client-user/:id", updateClientUser);
router.delete("/delete-client-user/:id", deleteClientUser);

module.exports = router;
