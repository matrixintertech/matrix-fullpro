export function getTwilioStubStatus() {
  return {
    available: false,
    code: "TWILIO_STUBBED",
    message: "Twilio chat is disabled for this phase and will be enabled on VPS deployment.",
  };
}
