import type { AccessTokenPayload } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import type { CreateUserInput, UpdateUserInput, UserFilters } from "@/server/interfaces/user";
import {
  createUser as createUserRepo,
  deleteUserById,
  findUserByEmail,
  findUserByMobile,
  getUserById as getUserByIdRepo,
  listUsers as listUsersRepo,
  updateUserById,
} from "@/server/repositories/user-repository";

function assertCanManageUsers(token: AccessTokenPayload): void {
  if (token.userFrom !== "User") {
    throw new ApiError("Only service partner users can manage users", 403, "FORBIDDEN");
  }
}

function normalizeFilters(token: AccessTokenPayload, filters: UserFilters): UserFilters {
  assertCanManageUsers(token);
  if (token.servicePartnerId) {
    return {
      ...filters,
      servicePartnerId: token.servicePartnerId,
    };
  }
  return filters;
}

function assertUserWriteScope(token: AccessTokenPayload, servicePartnerId: string): void {
  if (token.servicePartnerId && token.servicePartnerId !== servicePartnerId) {
    throw new ApiError("Forbidden for this service partner scope", 403, "FORBIDDEN");
  }
}

export async function listUsers(token: AccessTokenPayload, filters: UserFilters) {
  return listUsersRepo(normalizeFilters(token, filters));
}

export async function getUserById(token: AccessTokenPayload, id: string) {
  assertCanManageUsers(token);
  const user = await getUserByIdRepo(id);
  if (!user) {
    throw new ApiError("User not found", 404, "NOT_FOUND");
  }
  assertUserWriteScope(token, user.servicePartnerId);
  return user;
}

async function assertUniqueUser(email: string, mobile: string, excludeId?: string) {
  const [emailExists, mobileExists] = await Promise.all([
    findUserByEmail(email, excludeId),
    findUserByMobile(mobile, excludeId),
  ]);
  if (emailExists) {
    throw new ApiError("A user with this email already exists", 400, "EMAIL_EXISTS");
  }
  if (mobileExists) {
    throw new ApiError("A user with this mobile already exists", 400, "MOBILE_EXISTS");
  }
}

export async function createUser(token: AccessTokenPayload, input: CreateUserInput) {
  assertCanManageUsers(token);
  const resolvedServicePartnerId = token.servicePartnerId ?? input.servicePartnerId;
  if (!resolvedServicePartnerId) {
    throw new ApiError("servicePartnerId is required", 400, "SERVICE_PARTNER_REQUIRED");
  }

  assertUserWriteScope(token, resolvedServicePartnerId);
  await assertUniqueUser(input.email, input.mobile);
  return createUserRepo({
    ...input,
    servicePartnerId: resolvedServicePartnerId,
  });
}

export async function updateUser(
  token: AccessTokenPayload,
  id: string,
  input: UpdateUserInput
) {
  assertCanManageUsers(token);
  const existing = await getUserByIdRepo(id);
  if (!existing) {
    throw new ApiError("User not found", 404, "NOT_FOUND");
  }

  assertUserWriteScope(token, existing.servicePartnerId);

  const nextEmail = input.email ?? existing.email;
  const nextMobile = input.mobile ?? existing.mobile;
  await assertUniqueUser(nextEmail, nextMobile, id);

  return updateUserById(id, input);
}

export async function deleteUser(token: AccessTokenPayload, id: string) {
  assertCanManageUsers(token);
  const existing = await getUserByIdRepo(id);
  if (!existing) {
    throw new ApiError("User not found", 404, "NOT_FOUND");
  }
  assertUserWriteScope(token, existing.servicePartnerId);
  await deleteUserById(id);
  return { id };
}
