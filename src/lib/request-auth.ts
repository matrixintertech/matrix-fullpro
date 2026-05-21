import type { NextRequest } from "next/server";
import { ApiError } from "./errors";
import { extractBearerToken, verifyAccessToken, type AccessTokenPayload } from "./auth";

export async function requireAuth(request: NextRequest): Promise<AccessTokenPayload> {
  const authHeader = request.headers.get("authorization");
  const token = extractBearerToken(authHeader);

  if (!token) {
    throw new ApiError("Missing bearer token", 401, "UNAUTHORIZED");
  }

  return verifyAccessToken(token);
}
