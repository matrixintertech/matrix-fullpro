const otplib = require("otplib");
const { OtpModel } = require("./otp-modal");
const { ClientUserModal } = require("../client-user/clientUser-modal");
const { UserModal } = require("../user/user-modal");
const { SupplierModal } = require("../supplier/supplier-modal");
const { sendEmail } = require("../../utils/helpers");

// Send OTP to mobile number
const sendOtp = async (req, res) => {
  const { phoneNumber, is_new } = req.body;

  try {
    let user = null;
    let clientUser = null;
    let vendor = null;

    if (!is_new) {
      user = await UserModal.findOne({ mobile: phoneNumber }).populate(
        "servicePartnerId"
      );
      clientUser = await ClientUserModal.findOne({ mobile: phoneNumber });
      vendor = await SupplierModal.findOne({ mobile: phoneNumber });

      if (!user && !clientUser && !vendor) {
        return res
          .status(400)
          .json({ error: "Phone number is not registered with any user" });
      }

      // Check vendor verification status
      if (vendor && !vendor.isVerified) {
        return res.status(400).json({ error: "Vendor user is not verified" });
      }

      // Check service partner status for user or vendor
      const servicePartner = user?.servicePartnerId || vendor?.servicePartnerId;
      if (servicePartner?.status === "Pending") {
        return res
          .status(400)
          .json({ error: "The company details are pending for approval" });
      }

      if (servicePartner?.status === "Rejected") {
        return res.status(400).json({
          error:
            "Your login is restricted because company details are rejected!",
        });
      }
    }

    // Generate OTP
    otplib.authenticator.options = { digits: 6 };
    const otp = otplib.authenticator.generate(process.env.OTP_SECRET);
    const otpExpires = new Date(Date.now() + 30 * 60000); // 30 min from now

    // Delete expired OTPs if any
    await OtpModel.deleteMany({ phoneNumber, otpExpires: { $lt: new Date() } });

    // Save new OTP
    await OtpModel.findOneAndUpdate(
      { phoneNumber },
      { otp, otpExpires },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Send Email
    // sendEmail({
    //   recipientEmail: user?.email || clientUser?.email || vendor?.email,
    //   ccEmails: ["mi2005.delhi@gmail.com", "Erp.user@matrixonline.in"],
    //   subject: "OTP for login",
    //   body: `Your OTP for login is ${otp}. This OTP is valid for 30 minutes.`,
    // });

    console.log("otp sent to the registered email address", otp);
    return res.status(200).json({
      message: "OTP sent to the registered email address",
      data: { phoneNumber },
    });
  } catch (error) {
    console.error("Send OTP Error:", error);
    return res.status(500).json({
      message: "Failed to send OTP. Please try again later.",
      error: error.message,
    });
  }
};

// Verify OTP
const verifyOtp = async (req, res) => {
  const { phoneNumber, otp, is_new } = req.body;

  if (!phoneNumber || !otp) {
    return res.status(400).json({ error: "Phone number and OTP are required" });
  }

  try {
    const otpRecord = await OtpModel.findOne({ phoneNumber });

    if (
      !otpRecord ||
      otpRecord.otp !== otp ||
      new Date() > otpRecord.otpExpires
    ) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Clear OTP once verified
    otpRecord.otp = null;
    otpRecord.otpExpires = null;
    await otpRecord.save();

    // If existing user, return user info
    if (!is_new) {
      const user = await UserModal.findOne({ mobile: phoneNumber }).populate([
        "role",
        "servicePartnerId",
      ]);
      const clientUser = await ClientUserModal.findOne({
        mobile: phoneNumber,
      }).populate(["clientId", "reporting_to"]);
      const vendor = await SupplierModal.findOne({
        mobile: phoneNumber,
      });

      if (user) {
        return res.status(200).json({
          message: "OTP verified successfully",
          userId: user._id,
          userFrom: "User",
          userRole: user.role?.name,
        });
      } else if (clientUser) {
        return res.status(200).json({
          message: "OTP verified successfully",
          userId: clientUser._id,
          userFrom: "ClientUser",
        });
      } else if (vendor) {
        // Check vendor verification status
        if (!vendor.isVerified) {
          return res.status(400).json({ error: "Vendor user is not verified" });
        }

        return res.status(200).json({
          message: "OTP verified successfully",
          userId: vendor._id,
          userFrom: "Vendor",
        });
      }
    }

    // For new users
    return res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
};
