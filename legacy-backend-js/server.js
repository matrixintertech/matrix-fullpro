const http = require("http");
const app = require(".");
const logger = require("./config/logger.config");

const port = process.env.PORT || 3002;

const server = http.createServer(app);

server.on("error", (error) => {
  logger.error("Server error", error);
});

server.listen(port, () => {
  logger.info(`✅ Server running on port ${port}`);
});
