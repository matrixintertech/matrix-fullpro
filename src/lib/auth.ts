import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { ApiError } from "./errors";
import { getRequiredEnv } from "./env";

export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  userFrom: "User" | "ClientUser" | "Supplier";
  role?: string;
  servicePartnerId?: string;
  email?: string;
  mobile?: string;
}

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(getRequiredEnv("JWT_SECRET"));
}

export async function signAccessToken(
  payload: AccessTokenPayload,
  expiresIn = "12h"
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as AccessTokenPayload;
  } catch {
    throw new ApiError("Invalid or expired token", 401, "UNAUTHORIZED");
  }
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}
