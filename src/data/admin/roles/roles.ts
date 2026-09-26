export const permissionGroups = [
  {
    group: "User Management",
    permissions: ["View users", "Edit users", "Delete users", "Ban users"],
  },
  {
    group: "Job Moderation",
    permissions: ["View jobs", "Approve jobs", "Reject jobs", "Feature jobs"],
  },
  {
    group: "Pricing",
    permissions: ["View plans", "Edit plans", "Manage coupons"],
  },
  {
    group: "Analytics",
    permissions: ["View dashboard", "Export reports", "View revenue"],
  },
  {
    group: "Integrations",
    permissions: ["View integrations", "Manage API keys", "Configure webhooks"],
  },
  {
    group: "Automation",
    permissions: ["View rules", "Create rules", "Delete rules"],
  },
  {
    group: "Settings",
    permissions: ["View settings", "Edit settings", "Manage team"],
  },
];

export type PermissionGroup = (typeof permissionGroups)[number]["group"];

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  assignedUsers: { id: string; name: string; email: string }[];
  lastUpdated: string;
}

export const mockRoles: Role[] = [
  {
    id: "1",
    name: "Super Admin",
    description: "Full access to all features and settings",
    permissions: permissionGroups.flatMap((g) => g.permissions),
    assignedUsers: [
      { id: "u1", name: "Sarah Chen", email: "sarah@jobboard.io" },
      { id: "u2", name: "James Wilson", email: "james@jobboard.io" },
    ],
    lastUpdated: "2025-06-15",
  },
  {
    id: "2",
    name: "Moderator",
    description: "Can moderate jobs and manage users",
    permissions: [
      "View users", "Edit users", "Ban users",
      "View jobs", "Approve jobs", "Reject jobs",
      "View dashboard",
    ],
    assignedUsers: [
      { id: "u3", name: "Emily Park", email: "emily@jobboard.io" },
      { id: "u4", name: "Marcus Lee", email: "marcus@jobboard.io" },
      { id: "u5", name: "Anna Kowalski", email: "anna@jobboard.io" },
    ],
    lastUpdated: "2025-06-10",
  },
  {
    id: "3",
    name: "Analyst",
    description: "Read-only access to analytics and reports",
    permissions: ["View dashboard", "Export reports", "View revenue"],
    assignedUsers: [
      { id: "u6", name: "David Nguyen", email: "david@jobboard.io" },
    ],
    lastUpdated: "2025-05-28",
  },
  {
    id: "4",
    name: "Billing Manager",
    description: "Manage pricing plans and revenue",
    permissions: [
      "View plans", "Edit plans", "Manage coupons",
      "View dashboard", "View revenue",
    ],
    assignedUsers: [],
    lastUpdated: "2025-05-20",
  },
];

export const allUsers = [
  { id: "u1", name: "Sarah Chen", email: "sarah@jobboard.io" },
  { id: "u2", name: "James Wilson", email: "james@jobboard.io" },
  { id: "u3", name: "Emily Park", email: "emily@jobboard.io" },
  { id: "u4", name: "Marcus Lee", email: "marcus@jobboard.io" },
  { id: "u5", name: "Anna Kowalski", email: "anna@jobboard.io" },
  { id: "u6", name: "David Nguyen", email: "david@jobboard.io" },
  { id: "u7", name: "Lisa Thompson", email: "lisa@jobboard.io" },
  { id: "u8", name: "Robert Kim", email: "robert@jobboard.io" },
  { id: "u9", name: "Maria Garcia", email: "maria@jobboard.io" },
];
