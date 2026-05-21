export interface ServiceRequestFilters {
  servicePartnerId?: string;
  clientId?: string;
  clientUserId?: string;
}

export interface CreateServiceRequestInput {
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

export interface UpdateServiceRequestInput {
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
