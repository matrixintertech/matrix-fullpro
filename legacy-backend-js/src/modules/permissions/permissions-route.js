const express = require("express");
const { getAllPermissions } = require("./permissions-controller");
const router = express.Router();

router.get("/get-list", getAllPermissions);

module.exports = router;
