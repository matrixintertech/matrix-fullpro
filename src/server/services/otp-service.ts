import { authenticator } from "otplib";
import nodemailer from "nodemailer";
import { ApiError } from "@/lib/errors";
import { getRequiredEnv, isProduction } from "@/lib/env";
import { signAccessToken, type AccessTokenPayload } from "@/lib/auth";
import { prisma } from "@/server/db/prisma";
import { findPrincipalByPhone, type AuthPrincipal } from "@/server/repositories/auth-repository";

const OTP_EXPIRY_MINUTES = 30;
const DEFAULT_MAIL_FROM = "Matrix Intertech <no-reply@example.com>";

function getOtpEmailConfig() {
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;
  const from = process.env.MAIL_FROM || DEFAULT_MAIL_FROM;
  const host = process.env.MAIL_HOST;
  const port = process.env.MAIL_PORT ? Number(process.env.MAIL_PORT) : undefined;
  const secure = process.env.MAIL_SECURE === "true";

  if (!user || !pass) {
    throw new ApiError(
      "Email service is not configured. Set MAIL_USER and MAIL_PASS.",
      500,
      "MAIL_CONFIG_MISSING"
    );
  }

  return { user, pass, from, host, port, secure };
}

async function sendOtpEmail(input: {
  to: string;
  otp: string;
  expiresInMinutes: number;
}) {
  const { user, pass, from, host, port, secure } = getOtpEmailConfig();
  const transporter = host
    ? nodemailer.createTransport({
        host,
        port: port ?? 587,
        secure: port ? secure : false,
        auth: { user, pass },
      })
    : nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
      });

  try {
    await transporter.sendMail({
      from,
      to: input.to,
      subject: "Your Matrix OTP Code",
      text: `Your OTP is ${input.otp}. It will expire in ${input.expiresInMinutes} minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Matrix OTP Verification</h2>
          <p>Your OTP is:</p>
          <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">${input.otp}</p>
          <p>This code will expire in ${input.expiresInMinutes} minutes.</p>
          <p>If you did not request this code, you can ignore this email.</p>
        </div>
      `,
    });
  } catch {
    throw new ApiError(
      "Failed to send OTP email. Please try again.",
      502,
      "OTP_EMAIL_SEND_FAILED"
    );
  }
}

function assertPrincipalCanLogin(principal: AuthPrincipal): void {
  if (principal.userFrom === "Supplier" && principal.isVerified === false) {
    throw new ApiError("Vendor user is not verified", 400, "SUPPLIER_UNVERIFIED");
  }

  if (principal.servicePartnerStatus === "PENDING") {
    throw new ApiError(
      "Company details are pending for approval",
      400,
      "SERVICE_PARTNER_PENDING"
    );
  }

  if (principal.servicePartnerStatus === "REJECTED") {
    throw new ApiError(
      "Login restricted because company details are rejected",
      400,
      "SERVICE_PARTNER_REJECTED"
    );
  }
}

export async function sendOtp(input: { phoneNumber: string; isNew?: boolean }) {
  const { phoneNumber, isNew = false } = input;
  const principal = await findPrincipalByPhone(phoneNumber);

  if (!isNew) {
    if (!principal) {
      throw new ApiError(
        "Phone number is not registered with any user",
        400,
        "PHONE_NOT_REGISTERED"
      );
    }
    assertPrincipalCanLogin(principal);
  }

  const otpSecret = getRequiredEnv("OTP_SECRET");
  const otp = authenticator.generate(otpSecret);
  const otpExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otp.upsert({
    where: { phoneNumber },
    update: {
      otp,
      otpExpires,
    },
    create: {
      phoneNumber,
      otp,
      otpExpires,
    },
  });

  if (principal?.email) {
    await sendOtpEmail({
      to: principal.email,
      otp,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });
  } else if (isProduction()) {
    throw new ApiError(
      "No email is configured for this account. Contact admin.",
      400,
      "EMAIL_NOT_CONFIGURED"
    );
  }

  return {
    phoneNumber,
    expiresAt: otpExpires.toISOString(),
    ...(isProduction() ? {} : { otp }),
  };
}

export async function verifyOtp(input: {
  phoneNumber: string;
  otp: string;
  isNew?: boolean;
}) {
  const { phoneNumber, otp, isNew = false } = input;

  const otpRecord = await prisma.otp.findUnique({
    where: { phoneNumber },
  });

  if (!otpRecord || !otpRecord.otp || otpRecord.otp !== otp) {
    throw new ApiError("Invalid or expired OTP", 400, "INVALID_OTP");
  }

  if (!otpRecord.otpExpires || new Date() > otpRecord.otpExpires) {
    throw new ApiError("Invalid or expired OTP", 400, "EXPIRED_OTP");
  }

  await prisma.otp.update({
    where: { phoneNumber },
    data: { otp: null, otpExpires: null },
  });

  if (isNew) {
    return {
      message: "OTP verified successfully",
      isNew: true,
    };
  }

  const principal = await findPrincipalByPhone(phoneNumber);
  if (!principal) {
    throw new ApiError("User not found after OTP verification", 404, "USER_NOT_FOUND");
  }
  assertPrincipalCanLogin(principal);

  const tokenPayload: AccessTokenPayload = {
    sub: principal.id,
    userFrom: principal.userFrom,
    role: principal.role,
    servicePartnerId: principal.servicePartnerId,
    email: principal.email ?? undefined,
    mobile: principal.mobile ?? undefined,
  };

  const accessToken = await signAccessToken(tokenPayload);

  return {
    message: "OTP verified successfully",
    userId: principal.id,
    userFrom: principal.userFrom,
    userRole: principal.role,
    accessToken,
  };
}
