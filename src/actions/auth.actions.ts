"use server";

export async function requestOtpAction(phoneNumber: string) {
  return {
    success: false,
    code: "OTP_STUBBED",
    message: `OTP provider is stubbed for now. Requested for: ${phoneNumber}`,
  };
}

export async function verifyOtpAction(phoneNumber: string, otp: string) {
  return {
    success: false,
    code: "OTP_STUBBED",
    message: `OTP verification is stubbed for now. Phone: ${phoneNumber}, otp length: ${otp.length}`,
  };
}
