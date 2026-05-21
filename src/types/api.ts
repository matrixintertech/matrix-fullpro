import type { ServiceRequest, User, UserType } from "@prisma/client";

export interface ApiSuccess<T> {
  success: true;
  message?: string;
  data: T;
}

export interface ApiFailure {
  success: false;
  code: string;
  message: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface SendOtpRequest {
  phoneNumber: string;
  isNew?: boolean;
}

export interface VerifyOtpRequest {
  phoneNumber: string;
  otp: string;
  isNew?: boolean;
}

export interface SendOtpResponse {
  phoneNumber: string;
  expiresAt: string;
  otp?: string;
}

export interface VerifyOtpResponse {
  message: string;
  isNew?: boolean;
  userId?: string;
  userFrom?: "User" | "ClientUser" | "Supplier";
  userRole?: string;
  accessToken?: string;
}

export interface CreateServiceRequestDto {
  title: string;
  serviceType: string;
  description?: string;
  clientId?: string;
  clientUserId?: string;
  branchId?: string;
  callReferenceNumber?: string;
  costName?: string;
  servicePartnerId?: string;
}

export interface UpdateServiceRequestDto {
  title?: string;
  serviceType?: string;
  description?: string;
  clientId?: string | null;
  clientUserId?: string | null;
  branchId?: string | null;
  callReferenceNumber?: string | null;
  costName?: string | null;
  pmAssignedId?: string | null;
  smAssignedId?: string | null;
}

export interface CreateUserDto {
  name: string;
  email: string;
  mobile: string;
  roleId?: string | null;
  profileImage?: string | null;
  servicePartnerId?: string;
  userType: UserType;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  mobile?: string;
  roleId?: string | null;
  profileImage?: string | null;
  userType?: UserType;
}

export type ServiceRequestListResponse = ServiceRequest[];
export type UserListResponse = User[];
