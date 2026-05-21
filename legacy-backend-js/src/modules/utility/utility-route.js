const express = require("express");
const { sendEmailAPI } = require("./utililty-controller");
const router = express.Router();

router.post("/send-email", sendEmailAPI);

module.exports = router;
