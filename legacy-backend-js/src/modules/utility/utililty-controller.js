const { sendEmail, generatePDF } = require("../../utils/helpers");

const sendEmailAPI = async (req, res) => {
  const { subject, body, recipientEmail, ccEmails, htmlContent } = req.body;

  res.status(202).json({
    message: "",
  });

  if (htmlContent) {
    generatePDF(htmlContent)
      .then((pdfBuffer) =>
        sendEmail({
          subject,
          body,
          recipientEmail,
          ccEmails,
          pdfBuffer,
        })
      )
      .catch((error) => console.error("Error:", error));
  } else {
    sendEmail({
      subject,
      body,
      recipientEmail,
      ccEmails,
    });
  }
};

module.exports = { sendEmailAPI };
