const twilio = require("twilio");
const {
  sendSuccessResponse,
  sendFailedResponse,
} = require("../../utils/response");

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_CHAT_SERVICE_SID = process.env.TWILIO_CHAT_SID;
const TWILIO_API_SID = process.env.TWILIO_API_SID;
const TWILIO_API_SECRET = process.env.TWILIO_API_SECRET;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Generate Access Token
const generateAccessToken = (req, res) => {
  const identity = req?.query?.identity; // Unique user identity

  const AccessToken = twilio.jwt.AccessToken;
  const ChatGrant = AccessToken.ChatGrant;

  const token = new AccessToken(
    TWILIO_ACCOUNT_SID,
    TWILIO_API_SID,
    TWILIO_API_SECRET,
    { identity }
  );

  token.addGrant(new ChatGrant({ serviceSid: TWILIO_CHAT_SERVICE_SID }));

  sendSuccessResponse(res, { token: token.toJwt() });
};

// Create a new conversation
const getOrCreateConversation = async (req, res) => {
  const { service_id, service_name } = req.body;

  try {
    let conversation = null;
    try {
      conversation = await client.conversations.v1
        ?.services(TWILIO_CHAT_SERVICE_SID)
        .conversations(service_id)
        .fetch();
      // console.log(conversation, "conversationconversation");
    } catch (error) {
      if (error?.status === 404) {
        conversation = await client.conversations.v1
          ?.services(TWILIO_CHAT_SERVICE_SID)
          .conversations.create({
            uniqueName: service_id,
            friendlyName: service_name,
          });
      } else {
        throw error;
      }
    }

    sendSuccessResponse(res, { data: conversation });
  } catch (error) {
    sendFailedResponse(res, { message: "creating conversation failed" }, error);
  }
};

// Add participants to a conversation
const addParticipantToConversation = async (req, res) => {
  const { conversation_sid, identity } = req.body;
  try {
    await client.conversations.v1
      ?.services(TWILIO_CHAT_SERVICE_SID)
      .conversations(conversation_sid)
      .participants.create({
        identity: identity?._id,
        attributes: JSON.stringify({
          friendlyName: identity?.name,
          profilePicture: identity?.profilePicture,
        }),
      });

    sendSuccessResponse(res, {
      message: "Added Participants to the conversation successfully",
    });
  } catch (error) {
    sendFailedResponse(res, { message: "Adding participants failed" }, error);
  }
};

// Delete conversation
const deleteConversation = async (req, res) => {
  const { conversation_sid } = req.body;
  try {
    await client.conversations.v1
      ?.services(TWILIO_CHAT_SERVICE_SID)
      .conversations(conversation_sid)
      .remove();

    sendSuccessResponse(res, {
      message: "deleted conversation successfully",
    });
  } catch (error) {
    sendFailedResponse(res, { message: "conversation deletion failed" }, error);
  }
};

// Send a message
const sendMessage = async (req, res) => {
  const { conversationSid, message, author } = req.body;
  try {
    const messageResponse = await client.conversations.v1
      ?.services(TWILIO_CHAT_SERVICE_SID)
      .conversations(conversationSid)
      .messages.create({ body: message, author });

    sendSuccessResponse(res, { data: messageResponse });
  } catch (error) {
    sendFailedResponse(res, { message: "sending message failed" }, error);
  }
};

// Retrieve messages from a conversation
const getMessages = async (req, res) => {
  const { conversationSid } = req.query;
  try {
    const messages = await client.conversations.v1
      ?.services(TWILIO_CHAT_SERVICE_SID)
      .conversations(conversationSid)
      .messages.list();
    sendSuccessResponse(res, { data: messages });
  } catch (error) {
    sendFailedResponse(res, { message: "fetching messages failed" }, error);
  }
};

module.exports = {
  generateAccessToken,
  getOrCreateConversation,
  addParticipantToConversation,
  deleteConversation,
  sendMessage,
  getMessages,
};
