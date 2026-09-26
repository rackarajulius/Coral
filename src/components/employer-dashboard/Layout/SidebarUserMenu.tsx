import {
  ChevronsUpDown,
  CircleUser,
  CreditCard,
  BellDot,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  LifeBuoy,
  Check,
  EllipsisVertical,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const user = {
  name: "John Fletcher",
  email: "john@jobflow.io",
  avatar: "",
  initials: "JF",
};

export function SidebarUserMenu() {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out successfully");
    navigate("/employers");
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger  asChild>
        <button
          className="flex w-full items-center gap-2 rounded-xl p-2 text-left transition-colors duration-150 hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="h-8 w-8 shrink-0 rounded-lg">
            {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
            <AvatarFallback className="rounded-lg  text-xs font-semibold">
              {user.initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-sidebar-foreground leading-tight">
                  {user.name}
                </p>
                <p className="truncate text-[11px] text-muted-foreground leading-tight">
                  {user.email}
                </p>
              </div>
              <EllipsisVertical className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/60" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[260px] min-w-64 rounded-xl shadow-elevated"
        side="top"
        align="start"
        sideOffset={8}
      >
        {/* User Info Header */}
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-3 px-3 py-3">
            <Avatar className="h-10 w-10 rounded-lg">
              {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
              <AvatarFallback className="rounded-lg  text-sm font-semibold">
                {user.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Upgrade CTA */}
       
        {/* Settings Group */}
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => navigate("/employers/account/settings")}
          >
            <CircleUser className="h-4 w-4" />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => navigate("/employers/billing")}
          >
            <CreditCard className="h-4 w-4" />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => navigate("/employers/settings")}
          >
            <BellDot className="h-4 w-4" />
            Notifications
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Appearance */}
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2 px-2 py-1.5 rounded-sm cursor-pointer">
              {theme === "dark" ? (
                <Moon className="h-4 w-4 text-muted-foreground" />
              ) : theme === "light" ? (
                <Sun className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Monitor className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm">Appearance</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="rounded-xl p-1.5 min-w-[160px]" sideOffset={8}>
                {themeOptions.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    className="gap-2.5 px-3 py-2 rounded-lg cursor-pointer"
                    onClick={() => setTheme(opt.value)}
                  >
                    <opt.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{opt.label}</span>
                    {theme === opt.value && (
                      <Check className="h-3.5 w-3.5 ml-auto text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        {/* Help */}
        <DropdownMenuItem
          className="gap-2 cursor-pointer"
          onClick={() => navigate("/employers/settings")}
        >
          <LifeBuoy className="h-4 w-4" />
          Help & Support
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Logout */}
        <DropdownMenuItem
          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
          onClick={handleLogout}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
