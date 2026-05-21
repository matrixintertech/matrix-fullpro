import { authenticator } from "otplib";
import { ApiError } from "@/lib/errors";
import { getRequiredEnv, isProduction } from "@/lib/env";
import { signAccessToken, type AccessTokenPayload } from "@/lib/auth";
import { prisma } from "@/server/db/prisma";
import { findPrincipalByPhone, type AuthPrincipal } from "@/server/repositories/auth-repository";

const OTP_EXPIRY_MINUTES = 30;

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
