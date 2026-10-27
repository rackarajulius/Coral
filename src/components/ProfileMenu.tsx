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
  Building2,
  CircleUserRound,
  CreditCardIcon,
  LayoutDashboard,
  LogOutIcon,
  MessageSquare,
  Save,
  Settings,
  BriefcaseBusiness,
  UsersRound,
} from "lucide-react"
import { Link } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { accountSide, actsForCompany, companyLabel } from "@/lib/accountSide"

/**
 * One account does everything, as on LinkedIn, so the menu has two parts:
 * your own pages, which everyone has, and the company you act for — or a way
 * to create a company page if you don't act for one yet. Freelancer accounts
 * keep their own menu for now, and an admin also gets the admin dashboard.
 */
const COMPANY_ITEMS = [
  { to: "/employers/dashboard", label: "Company dashboard", icon: LayoutDashboard },
  { to: "/employers/chat", label: "Company chat", icon: MessageSquare },
  { to: "/employers/notifications", label: "Company notifications", icon: BellIcon },
  { to: "/employers/settings", label: "Company settings", icon: Settings },
]
const SEEKER_ITEMS = [
  { to: "/jobseeker/profile", label: "Profile", icon: CircleUserRound },
  { to: "/provider", label: "Offer services", icon: BriefcaseBusiness },
  { to: "/saved-jobs", label: "Saved Jobs", icon: Save },
  { to: "/jobseeker/chat", label: "Chat", icon: MessageSquare },
  { to: "/jobseeker/settings", label: "Settings", icon: Settings },
  { to: "/notifications", label: "Notifications", icon: BellIcon },
]
const PROVIDER_ITEMS = [
  { to: "/provider", label: "Provider profile", icon: CircleUserRound },
  { to: "/providers", label: "Find professionals", icon: UsersRound },
  { to: "/community", label: "Community", icon: MessageSquare },
]
const ADMIN_ITEMS = [{ to: "/admin/dashboard", label: "Admin dashboard", icon: LayoutDashboard }, ...SEEKER_ITEMS.filter((item) => item.to !== '/provider')]

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
  // Not yet on an employer account's personal side: offering services (the
  // freelancer side) and AI Job Match, which needs Premium — still a job
  // seeker plan.
  const items =
    side === "admin" ? ADMIN_ITEMS
      : side === "provider" ? PROVIDER_ITEMS
        : side === "employer" ? SEEKER_ITEMS.filter((item) => item.to !== "/provider" && item.to !== "/resume-matcher")
          : SEEKER_ITEMS
  const showCompany = side !== "provider"
  const forCompany = actsForCompany(user)

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
        {showCompany && (
          <>
            <DropdownMenuSeparator />
            {forCompany ? (
              <DropdownMenuGroup>
                <DropdownMenuLabel className="truncate text-xs font-medium text-muted-foreground">
                  {companyLabel(user)}
                </DropdownMenuLabel>
                {COMPANY_ITEMS.map(({ to, label, icon: Icon }) => (
                  <DropdownMenuItem asChild key={to}>
                    <Link to={to} className="flex items-center">
                      <Icon className="mr-2 h-4 w-4" size={14} />
                      {label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            ) : (
              <DropdownMenuItem asChild>
                <Link to="/employers/onboarding" className="flex items-center">
                  <Building2 className="mr-2 h-4 w-4" size={14} />
                  Create a company page
                </Link>
              </DropdownMenuItem>
            )}
          </>
        )}
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
