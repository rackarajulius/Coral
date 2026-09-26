import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  BadgeCheckIcon,
  BellIcon,
  CircleUserRound,
  CreditCardIcon,
  LayoutDashboard,
  LogOutIcon,
  MessageSquare,
  Save,
  Settings,
} from "lucide-react"
import { Link } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { accountSide } from "@/lib/accountSide"

/**
 * The menu follows the account: an employer's links go to the employer side
 * (job seeker pages would only send them back), an admin also gets the admin
 * dashboard, and everyone else gets the job seeker pages.
 */
const EMPLOYER_ITEMS = [
  { to: "/employers/dashboard", label: "Employer dashboard", icon: LayoutDashboard },
  { to: "/employers/messages", label: "Messages", icon: MessageSquare },
  { to: "/employers/notifications", label: "Notifications", icon: BellIcon },
  { to: "/employers/settings", label: "Settings", icon: Settings },
]
const SEEKER_ITEMS = [
  { to: "/jobseeker/profile", label: "Profile", icon: CircleUserRound },
  { to: "/saved-jobs", label: "Saved Jobs", icon: Save },
  { to: "/jobseeker/messages", label: "Messages", icon: MessageSquare },
  { to: "/jobseeker/settings", label: "Settings", icon: Settings },
  { to: "/notifications", label: "Notifications", icon: BellIcon },
]
const ADMIN_ITEMS = [{ to: "/admin/dashboard", label: "Admin dashboard", icon: LayoutDashboard }, ...SEEKER_ITEMS]

const ProfileMenu = () => {
  const { user, logout, isAuthenticated, enableBackendSync } = useAuth();

  // Enable backend sync for job seeker context
  React.useEffect(() => {
    enableBackendSync(true);
  }, [enableBackendSync]);

  if (!isAuthenticated || !user) {
    return null; // Don't show profile menu when not authenticated (AuthModal handles login)
  }

  const side = accountSide(user)
  const items = side === "employer" ? EMPLOYER_ITEMS : side === "admin" ? ADMIN_ITEMS : SEEKER_ITEMS

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatarUrl || undefined} alt={user.displayName || 'User'} />
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
        <DropdownMenuGroup>
          {items.map(({ to, label, icon: Icon }) => (
            <DropdownMenuItem asChild key={to}>
              <Link to={to} className="flex items-center">
                <Icon className="mr-2 h-4 w-4" size={14} />
                {label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={logout}
        >
          <LogOutIcon className="mr-2 h-4 w-4" size={14} />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
export default ProfileMenu;