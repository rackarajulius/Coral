export type NotificationTab = "all" | "unread" | "mentions" | "archived";

export const DATE_GROUPS = ["Today", "Yesterday", "This week", "Earlier"] as const;
export type DateGroup = (typeof DATE_GROUPS)[number];
