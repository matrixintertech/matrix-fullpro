const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");
const { UserModal } = require("../modules/user/user-modal");
const { ClientUserModal } = require("../modules/client-user/clientUser-modal");
const { ClientModel } = require("../modules/client/client-model");
const {
  ServicePartnerModel,
} = require("../modules/service-partner/service-partner-model");
const { SupplierModal } = require("../modules/supplier/supplier-modal");
// const { google } = require("googleapis");

const models = [
  { name: "User", model: UserModal },
  { name: "Client User", model: ClientUserModal },
  { name: "Client", model: ClientModel },
  { name: "Service Partner", model: ServicePartnerModel },
  { name: "Supplier", model: SupplierModal },
];

// async function getNewAccessToken() {
//   const response = await fetch(
//     "https://login.microsoftonline.com/78952e5a-20eb-4219-8eb4-67e576246b2f/oauth2/v2.0/token",
//     {
//       method: "POST",
//       headers: { "Content-Type": "application/x-www-form-urlencoded" },
//       body: new URLSearchParams({
//         client_id: "354c44f7-e19a-4a94-b744-54dc6b511453",
//         client_secret: "<REDACTED_CLIENT_SECRET>",
//         grant_type: "refresh_token",
//         refresh_token:
//           "<REDACTED_REFRESH_TOKEN>",
//       }),
//     }
//   );
//   const data = await response.json();
//   console.log(data, "dataaaa");

//   return data.access_token;
// }

async function checkIfNumberEmailUnique(mobile, email, _id = null) {
  if (!mobile && !email) {
    throw new Error("At least one of mobile or email is required");
  }

  let results = [];
  let messages = [];

  // Iterate through each model and perform independent queries.
  for (const { name, model } of models) {
    // Query separately for mobile and email
    const mobileRecord = mobile ? await model.findOne({ mobile }) : null;
    const emailRecord = email ? await model.findOne({ email }) : null;

    // Check for conflict based on _id (if provided)
    const isMobileConflict =
      mobileRecord && (!_id || mobileRecord._id.toString() !== _id.toString());
    const isEmailConflict =
      emailRecord && (!_id || emailRecord._id.toString() !== _id.toString());

    if (isMobileConflict || isEmailConflict) {
      // If both exist and are from the same document, combine the message.
      if (
        isMobileConflict &&
        isEmailConflict &&
        mobileRecord._id.toString() === emailRecord._id.toString()
      ) {
        results.push({
          model: name,
          data: mobileRecord.toObject(),
        });
        messages.push(`A ${name} is created with this mobile number and email`);
      } else {
        // If mobile conflict exists separately:
        if (isMobileConflict) {
          results.push({
            model: name,
            data: mobileRecord.toObject(),
          });
          messages.push(`A ${name} is created with this mobile number`);
        }
        // If email conflict exists separately:
        if (isEmailConflict) {
          // Avoid pushing duplicate record if it was already added from mobileRecord.
          if (
            !isMobileConflict ||
            (mobileRecord &&
              emailRecord &&
              mobileRecord._id.toString() !== emailRecord._id.toString())
          ) {
            results.push({
              model: name,
              data: emailRecord.toObject(),
            });
          }
          messages.push(`A ${name} is created with this email`);
        }
      }
    }
  }

  if (results.length > 0) {
    return { error: messages.join(" | "), details: results };
  }

  return {
    success: true,
    message: "Mobile and Email are unique or valid for update",
  };
}

async function generateRequestNumber(
  prefix,
  clientName,
  Modal,
  fieldName = "serviceNumber"
) {
  if (!clientName || !clientName.trim()) {
    throw new Error("Client name cannot be empty");
  }

  const cleanClient = clientName.trim().toUpperCase();

  // console.log(cleanClient, "cleanClient");

  const regexPattern = new RegExp(`^${prefix}-${cleanClient}-\\d+$`);

  // console.log(regexPattern, "regexPattern");

  const lastEntry = await Modal.findOne({
    [fieldName]: { $regex: regexPattern },
  })
    .sort({ createdAt: -1 })
    .limit(1)
    .exec();

  // console.log(lastEntry, "lastEntry");

  let nextNumber = 1;

  if (lastEntry && lastEntry[fieldName]) {
    const parts = lastEntry[fieldName].split("-");
    const lastNumStr = parts[parts.length - 1];
    const lastNum = parseInt(lastNumStr, 10);
    nextNumber = lastNum + 1;
    // console.log(parts, "parts");
    // console.log(lastNumStr, "lastNumStr");
    // console.log(lastNum, "lastNum");
    // console.log(nextNumber, "nextNumber");
  }

  const paddedNum =
    nextNumber < 1000
      ? String(nextNumber).padStart(4, "0")
      : String(nextNumber);

  const newRequestNumber = `${prefix}-${cleanClient}-${paddedNum}`;

  return newRequestNumber;
}

const generatePDF = async (htmlContent) => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  // Set content
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  // Delay to ensure styles are applied
  await new Promise((resolve) => setTimeout(resolve, 2000));

  await page.setContent(htmlContent);
  const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });

  await browser.close();
  return pdfBuffer;
};

// Function to send email with PDF attachment
const sendEmail = async ({
  subject,
  body,
  recipientEmail,
  pdfBuffer,
  ccEmails = [],
}) => {
  try {
    // const oauth2Client = new google.auth.OAuth2(
    //   "354c44f7-e19a-4a94-b744-54dc6b511453",
    //   "<REDACTED_CLIENT_SECRET>",
    //   "https://login.microsoftonline.com/78952e5a-20eb-4219-8eb4-67e576246b2f/oauth2/v2.0/token"
    // );

    // oauth2Client.setCredentials({
    //   refresh_token: "<REDACTED_REFRESH_TOKEN>",
    // });

    // const transporter = nodemailer.createTransport({
    //   host: "email-smtp.ap-south-1.amazonaws.com",
    //   port: 465,
    //   secure: true,
    //   auth: {
    //     user: "<REDACTED_AWS_SMTP_USER>",
    //     pass: "<REDACTED_AWS_SMTP_PASS>",
    //   },
    // });

    // let mailOptions = {
    //   from: "Support@matrixonline.in",
    //   to: recipientEmail,
    //   cc: ccEmails,
    //   subject: subject,
    //   text: body,
    // };

    // const accessToken = await getNewAccessToken();
    // const transporter = nodemailer.createTransport({
    //   host: "smtp.office365.com",
    //   port: 587,
    //   secure: false,
    //   auth: {
    //     type: "OAuth2",
    //     user: "support@matrixonline.in",
    //     clientId: "354c44f7-e19a-4a94-b744-54dc6b511453",
    //     clientSecret: "<REDACTED_CLIENT_SECRET>",
    //     refreshToken:
    //       "<REDACTED_REFRESH_TOKEN>",
    //     accessToken,
    //   },
    // });
    const mailUser = process.env.MAIL_USER;
    const mailPass = process.env.MAIL_PASS;
    const mailFrom = process.env.MAIL_FROM || "Matrix Intertech <no-reply@example.com>";

    if (!mailUser || !mailPass) {
      throw new Error("MAIL_USER and MAIL_PASS must be set in environment variables");
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: mailUser,
        pass: mailPass,
      },
    });
    // var transporter = nodemailer.createTransport({
    //   service: "gmail",
    //   auth: {
    //     user: "<REDACTED_MAIL_USER>",
    //     pass: "<REDACTED_MAIL_PASS>",
    //   },
    // });

    const mailOptions = {
      // from: "support",
      from: mailFrom,
      to: recipientEmail,
      cc: ccEmails,
      subject,
      text: body,
    };

    if (pdfBuffer) {
      mailOptions.attachments = [
        {
          filename: "quotation.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ];
    }

    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully!");
  } catch (err) {
    console.log("Error sending email:", err);
  }
};

module.exports = {
  generateRequestNumber,
  generatePDF,
  sendEmail,
  checkIfNumberEmailUnique,
};

