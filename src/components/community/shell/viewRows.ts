import {
  Bookmark, CircleUserRound, FolderKanban, Inbox, Send, Store, UsersRound, type LucideIcon,
} from "lucide-react";
import type { CommunityView } from "./viewingAs";

export interface ViewRow {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Each side's own pages, for the profile menu and the nav alike. */
export const VIEW_ROWS: Record<CommunityView, ViewRow[]> = {
  freelancer: [
    { to: "/provider", label: "My provider profile", icon: CircleUserRound },
    { to: "/marketplace/manage?kind=service", label: "My services", icon: Store },
    { to: "/marketplace/inbox?box=incoming", label: "Requests from clients", icon: Inbox },
  ],
  client: [
    { to: "/providers", label: "Find professionals", icon: UsersRound },
    { to: "/providers/saved", label: "Saved professionals", icon: Bookmark },
    { to: "/services", label: "Browse services", icon: Store },
    { to: "/marketplace/manage?kind=project", label: "My project briefs", icon: FolderKanban },
    { to: "/marketplace/inbox?box=outgoing", label: "Requests I've sent", icon: Send },
  ],
};

/** What each side's part of the nav is called. */
export const VIEW_SECTIONS: Record<CommunityView, string> = { freelancer: "Your work", client: "Hiring" };
