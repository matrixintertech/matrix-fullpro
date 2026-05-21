import { ApiError } from "@/lib/errors";

export function isTwilioAvailable(): boolean {
  return false;
}

export function createTwilioAccessToken(_identity: string): string {
  throw new ApiError(
    "Twilio chat is intentionally stubbed for this phase.",
    501,
    "TWILIO_STUBBED"
  );
}

export async function getOrCreateConversation(_serviceId: string, _serviceName: string) {
  throw new ApiError(
    "Twilio chat is intentionally stubbed for this phase.",
    501,
    "TWILIO_STUBBED"
  );
}

export async function sendConversationMessage(
  _conversationSid: string,
  _author: string,
  _message: string
) {
  throw new ApiError(
    "Twilio chat is intentionally stubbed for this phase.",
    501,
    "TWILIO_STUBBED"
  );
}

export async function getConversationMessages(_conversationSid: string) {
  throw new ApiError(
    "Twilio chat is intentionally stubbed for this phase.",
    501,
    "TWILIO_STUBBED"
  );
}
