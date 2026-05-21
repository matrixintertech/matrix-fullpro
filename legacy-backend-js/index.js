require("dotenv").config();
const express = require("express");
const cors = require("cors");
const router = require("./router");
const { errorHandler } = require("./middleware/errorHandler");
require("./config/db");

const app = express();

app.use(express.static("public"));

app.use(cors());
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(express.json({ limit: "100mb" }));
app.use("/api/v1", router);

app.use((error, req, res, next) => {
  errorHandler(error, req, res, next);
});

module.exports = app;
