import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

/**
 * Marketplace pages, inside the community shell.
 *
 * The shell's nav lists these same pages from lg up, so the strip of tabs is
 * only for smaller screens, where that nav is folded into a drawer.
 */
export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
    <nav aria-label="Marketplace" className="mb-7 flex flex-wrap gap-2 border-b pb-4 lg:hidden">{[
      { to: "/services", label: "Find services" }, { to: "/projects", label: "Project work" }, { to: "/providers", label: "Professionals" },
      ...(user ? [{ to: "/marketplace/manage", label: "My listings" }, { to: "/marketplace/inbox", label: "Marketplace inbox" }] : []),
    ].map(({ to, label }) => <NavLink key={to} to={to} className={({ isActive }) => cn("rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>{label}</NavLink>)}</nav>
    {children}
  </main>;
}
