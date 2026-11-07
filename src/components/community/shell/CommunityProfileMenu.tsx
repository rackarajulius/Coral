import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight, BriefcaseBusiness, LayoutDashboard, LogOutIcon, Settings, User as UserIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useViewingAs } from "@/hooks/useViewingAs";
import { accountSide, actsForCompany, companyLabel } from "@/lib/accountSide";
import { personName } from "@/lib/personName";
import { viewHref } from "./feedViews";
import { VIEW_ROWS, type ViewRow } from "./viewRows";
import { VIEW_LABELS, VIEW_LANDING, otherView } from "./viewingAs";

function MenuRows({ rows }: { rows: ViewRow[] }) {
  return (
    <DropdownMenuGroup>
      {rows.map(({ to, label, icon: Icon }) => (
        <DropdownMenuItem asChild key={to}>
          <Link to={to} className="flex items-center">
            <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
            {label}
          </Link>
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  );
}

/**
 * The community's profile menu.
 *
 * Its own rather than the main site's: this tab is where freelancers find
 * clients and clients find professionals, so the menu follows which of those
 * someone is here as. The rest of the site is one link away, at the foot of
 * the nav.
 */
export function CommunityProfileMenu() {
  const { user, logout, enableBackendSync } = useAuth();
  const { view, canSwitch, choose } = useViewingAs();
  const navigate = useNavigate();

  // The main site's menu turns this on, and this one stands in for it here.
  useEffect(() => {
    enableBackendSync(true);
  }, [enableBackendSync]);

  if (!user || !view) return null;

  const side = accountSide(user);
  const switchTo = otherView(view);
  const name = personName(user) || "You";

  const switchView = () => {
    choose(switchTo);
    navigate(VIEW_LANDING[switchTo]);
  };

  const viewRows: ViewRow[] = view === "freelancer"
    ? [...VIEW_ROWS.freelancer, { to: viewHref("opportunity"), label: "Find work", icon: BriefcaseBusiness }]
    : VIEW_ROWS.client;
  const ownRows: ViewRow[] = [
    ...(side === "admin" ? [{ to: "/admin/dashboard", label: "Admin dashboard", icon: LayoutDashboard }] : []),
    { to: viewHref("mine"), label: "Your posts", icon: UserIcon },
    // Freelancer accounts have no settings page yet; the main menu leaves it out too.
    ...(side === "provider" ? [] : [{ to: "/jobseeker/settings", label: "Settings", icon: Settings }]),
  ];

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Your menu">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatarUrl || undefined} alt="" />
            <AvatarFallback className="bg-coral/10 text-xs font-medium text-coral">
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      {/* Laid out as the main site's menu is: only the rows differ. */}
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {canSwitch && (
          <>
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
              Viewing as: {VIEW_LABELS[view]}
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={switchView} className="flex items-center">
              <ArrowLeftRight className="mr-2 h-4 w-4" aria-hidden="true" />
              Switch to {VIEW_LABELS[switchTo]}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <MenuRows rows={viewRows} />
        <DropdownMenuSeparator />

        {view === "client" && actsForCompany(user) && (
          <>
            <DropdownMenuLabel className="truncate text-xs font-medium text-muted-foreground">
              {companyLabel(user)}
            </DropdownMenuLabel>
            <MenuRows rows={[{ to: "/employers/dashboard", label: "Company dashboard", icon: LayoutDashboard }]} />
            <DropdownMenuSeparator />
          </>
        )}

        <MenuRows rows={ownRows} />
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={logout}>
          <LogOutIcon className="mr-2 h-4 w-4" aria-hidden="true" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
