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
  LogOutIcon,
  Save,
  Settings,
} from "lucide-react"
import { Link } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useAuthModal } from "@/contexts/AuthModalContext"

const ProfileMenu = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { openAuth } = useAuthModal();

  if (!isAuthenticated || !user) {
    return (
      <Button variant="outline" onClick={() => openAuth()}>
        Sign In
      </Button>
    );
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar>
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
          <DropdownMenuItem asChild>
            <Link to="/jobseeker/profile" className="flex items-center">
              <CircleUserRound className="mr-2 h-4 w-4" size={14} />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/saved-jobs" className="flex items-center">
              <Save className="mr-2 h-4 w-4" size={14} />
              Saved Jobs
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/jobseeker/settings" className="flex items-center">
              <Settings className="mr-2 h-4 w-4" size={14} />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/notifications" className="flex items-center">
              <BellIcon className="mr-2 h-4 w-4" size={14} />
              Notifications
            </Link>
          </DropdownMenuItem>
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