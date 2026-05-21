const { formatMongooseError } = require("./validations");

const sendSuccessResponse = (res, object = {}) => {
  return res?.status(200)?.send({ status: "success", ...object });
};

const sendFailedResponse = (res, object = {}, error) => {
  console.log(error, "Error Logged");
  return res
    ?.status(500)
    ?.send({ status: "failed", ...object, error: formatMongooseError(error) });
};

module.exports = { sendSuccessResponse, sendFailedResponse };
