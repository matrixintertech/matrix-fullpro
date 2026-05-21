const express = require("express");
const {
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  deleteRole,
} = require("./role-controller");
const router = express.Router();

router.post("/create-role", createRole);
router.get("/get-all-role", getAllRoles);
router.get("/get-role-by-id/:id", getRoleById);
router.post("/update-role/:id", updateRole);
router.delete("/delete-role/:id", deleteRole);

module.exports = router;
