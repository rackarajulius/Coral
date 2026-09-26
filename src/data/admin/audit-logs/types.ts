export type ActionType = "Create" | "Update" | "Delete" | "Approve" | "Reject" | "Login" | "Export" | "Settings Change";
export type EntityType = "Job" | "Employer" | "Jobseeker" | "Application" | "Verification" | "Settings" | "System";
export type LogStatus = "Success" | "Failed";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  adminUser: string;
  adminAvatar?: string;
  action: ActionType;
  entityType: EntityType;
  entityName: string;
  entityId: string;
  changeSummary: string;
  status: LogStatus;
  ipAddress: string;
  device?: string;
  source: "Admin Panel" | "API";
  region?: string;
  requestId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  relatedActions?: { id: string; action: ActionType; entityName: string; timestamp: string }[];
}
