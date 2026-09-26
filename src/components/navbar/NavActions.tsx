import { Link } from "react-router-dom";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { accountSide } from "@/lib/accountSide";

interface NavActionsProps {
  onMobileOpen: () => void;
}

/**
 * Where the avatar menu leads on the employer site, by account.
 *
 * Job seekers never see this bar — the employer side sends them home — so
 * there is nothing here for them. A new account that hasn't chosen a side is
 * offered employer setup, since that is what brought it here.
 */
function menuFor(side: ReturnType<typeof accountSide>) {
  if (side === "admin") {
    return [
      { to: "/admin/dashboard", label: "Admin dashboard" },
      { to: "/employers/dashboard", label: "Employer dashboard" },
    ];
  }
  if (side === "undecided") {
    return [{ to: "/employers/dashboard", label: "Set up your employer account" }];
  }
  return [
    { to: "/employers/dashboard", label: "Employer dashboard" },
    { to: "/employers/settings", label: "Settings" },
  ];
}

export const NavActions = ({ onMobileOpen }: NavActionsProps) => {
  // A single AuthProvider now wraps the whole app, so useAuth is always available.
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const side = accountSide(user);

  return (
    <div className="flex items-center gap-2">
    {/* The signed-in user's real notifications. There used to be a bell here
        with three made-up ones and an unread dot, shown even to visitors. */}
    {isAuthenticated && user && (
      <NotificationBell className="text-muted-foreground hover:text-foreground" />
    )}

    {/* While auth resolves on refresh, show a neutral avatar placeholder —
        never the Sign In button — so it doesn't flash (matches the home Header). */}
    {isLoading ? (
      <div className="h-8 w-8 rounded-full bg-muted animate-pulse" aria-hidden="true" />
    ) : isAuthenticated && user ? (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatarUrl || undefined} />
              <AvatarFallback className="bg-coral/10 text-coral text-xs font-medium">
                {user.displayName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">{user.displayName || 'User'}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {menuFor(side).map((item) => (
            <DropdownMenuItem asChild key={item.to + item.label}>
              <Link to={item.to}>{item.label}</Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null}

    {/* Desktop CTA - shown when signed out (and only once auth has resolved) */}
    {!isLoading && !isAuthenticated && (
      <div className="hidden lg:flex items-center gap-3 ml-2">
        <div className="h-5 w-px bg-border" />
        <Button variant="outline" onClick={() => openAuth()}>
          Sign In
        </Button>
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          For Job Seekers
        </Link>
      </div>
    )}

    {/* Mobile hamburger */}
    <Button
      variant="ghost"
      size="icon"
      className="lg:hidden text-muted-foreground"
      onClick={onMobileOpen}
    >
      <Menu className="h-5 w-5" />
    </Button>
  </div>
  );
};
