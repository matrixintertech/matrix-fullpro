export interface UserFilters {
  servicePartnerId?: string;
  roleId?: string;
  userType?: "ADMIN" | "SERVICE_PARTNER_USER";
}

export interface CreateUserInput {
  name: string;
  email: string;
  mobile: string;
  roleId?: string | null;
  profileImage?: string | null;
  servicePartnerId?: string;
  userType: "ADMIN" | "SERVICE_PARTNER_USER";
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  mobile?: string;
  roleId?: string | null;
  profileImage?: string | null;
  userType?: "ADMIN" | "SERVICE_PARTNER_USER";
}
