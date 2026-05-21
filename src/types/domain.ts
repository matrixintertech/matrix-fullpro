export type ServiceStatus =
  | "Request Sent"
  | "Work in Progress"
  | "Rejected"
  | "Revised";

export interface ServiceListItem {
  id: string;
  date: string;
  title: string;
  description: string;
  status: ServiceStatus;
}

export interface ServiceRequestFormData {
  title: string;
  serviceType: string;
  description: string;
  photos: string[];
}

export interface TimelineStep {
  title: string;
  description: string;
  completed: boolean;
  hasAction?: boolean;
  actionLabel?: string;
  action?: () => void;
}

export interface TaskRow {
  id: number;
  srNo: number;
  rcNo: number;
  itemsToBeDone: string;
  unit: string;
  appQty: number;
  usedQty: number;
  rate: number;
  amount: number;
  remarks: number;
}
