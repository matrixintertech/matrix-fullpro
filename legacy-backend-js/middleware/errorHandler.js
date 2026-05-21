const logger = require('../config/logger.config');

const errorMessages = {
  SOMETHING_WENT_WRONG: 'Something went wrong',
  OTP_NOT_FOUND_OR_EXPIRED: 'OTP not found or expired',
  NOT_FOUND: 'Not found',
  USER_NOT_FOUND: 'User not found',
  MISSING_REQUIRED_FIELDS: 'Missing required fields',
  WRONG_PASSWORD: 'Wrong password',
  USER_ALREADY_EXISTS: 'A user with this email or phone number already exists.',
  USER_ALREADY_EXISTS_EMAIL: 'A user with this email already exists.',
  USER_ALREADY_EXISTS_PHONE: 'A user with this phone number already exists.',
  OTP_ALREADY_SENT: 'OTP has already been sent to this email.',
};

const errorHandler = async (error, req, res) => {
  let { message } = error;
  logger.error(message, error);
  if (errorMessages[message]) {
    message = errorMessages[message];
    return res.status(400).json({
      success: false,
      message: message,
    });
  } else if (error.name === 'ValidationError') {
    return res.status(422).json({
      success: false,
      message: error.message,
    });
  }
  return res.status(500).json({
    success: false,
    message: errorMessages.SOMETHING_WENT_WRONG,
  });
};

module.exports = {
  errorHandler,
  errorMessages,
};
