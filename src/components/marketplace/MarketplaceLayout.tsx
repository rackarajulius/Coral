import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <><Header /><main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-24 sm:px-6">
    <Link to="/community" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to the community</Link>
    <nav aria-label="Marketplace" className="mb-7 flex flex-wrap gap-2 border-b pb-4">{[
      { to: "/services", label: "Find services" }, { to: "/projects", label: "Project work" }, { to: "/providers", label: "Professionals" },
      ...(user ? [{ to: "/marketplace/manage", label: "My listings" }, { to: "/marketplace/inbox", label: "Marketplace inbox" }] : []),
    ].map(({ to, label }) => <NavLink key={to} to={to} className={({ isActive }) => cn("rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>{label}</NavLink>)}</nav>
    {children}
  </main></>;
}
