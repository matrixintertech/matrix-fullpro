function formatMongooseError(error) {
  if (!error) {
    return {
      message: "An unknown error occurred.",
      details: [],
    };
  }

  if (error.name === "ValidationError") {
    const details = Object.values(error.errors).map((err) => ({
      field: err.path,
      message: err.message,
    }));
    return {
      message: "Validation failed.",
      details,
    };
  }

  if (error.code === 11000) {
    const duplicateField = Object.keys(error.keyValue).join(", ");
    return {
      message: `Duplicate value error for field(s): ${duplicateField}. Please use unique values.`,
      details: [],
    };
  }

  if (error.name === "CastError") {
    return {
      message: `Invalid value provided for field: ${error.path}.`,
      details: [],
    };
  }

  return {
    message: error.message || "An error occurred during the operation.",
    details: [],
  };
}

function validateObjectId(id, fieldName = "ID") {
  if (!id || id === "undefined" || id === "null") {
    return {
      isValid: false,
      error: {
        message: `Invalid or missing ${fieldName} parameter.`,
        statusCode: 400,
      },
    };
  }

  return { isValid: true };
}

module.exports = { formatMongooseError, validateObjectId };
