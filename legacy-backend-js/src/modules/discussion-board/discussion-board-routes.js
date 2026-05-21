const express = require("express");
const {
  generateAccessToken,
  sendMessage,
  getMessages,
  getOrCreateConversation,
  deleteConversation,
  addParticipantToConversation,
} = require("./discussion-board-controller");

const router = express.Router();

router.get("/generate-access-token", generateAccessToken);
router.post("/get-or-create-conversation", getOrCreateConversation);
router.post("/add-participant-to-conversation", addParticipantToConversation);
router.post("/delete-conversation", deleteConversation);
router.post("/send-message", sendMessage);
router.get("/get-messages", getMessages);

module.exports = router;
