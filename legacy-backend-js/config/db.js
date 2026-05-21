const mongoose = require("mongoose");
const logger = require("./logger.config");
require("dotenv").config();

// MongoDB connection options for Mongoose 8.x
const connectionOptions = {
  // These options are recommended for Mongoose 8.x
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
  family: 4, // Use IPv4, skip trying IPv6
};

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  logger.error("🚫 DATABASE_URL is not set in environment variables");
  process.exit(1);
}

mongoose
  .connect(process.env.DATABASE_URL, connectionOptions)
  .then(() => {
    logger.info("✅ MongoDB connected successfully");
  })
  .catch((err) => {
    logger.error("🚫 MongoDB connection failed", {
      message: err.message,
      code: err.code,
      stack: err.stack,
    });

    // Provide helpful error messages
    if (err.code === "ENOTFOUND") {
      logger.error(
        "💡 DNS resolution failed. Please check:\n" +
          "1. Your internet connection\n" +
          "2. The MongoDB Atlas cluster is still active\n" +
          "3. The connection string in .env file is correct\n" +
          "4. Your IP address is whitelisted in MongoDB Atlas"
      );
    }
  });

// Handle connection events
mongoose.connection.on("disconnected", () => {
  logger.warn("⚠️ MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  logger.error("❌ MongoDB connection error:", err);
});
