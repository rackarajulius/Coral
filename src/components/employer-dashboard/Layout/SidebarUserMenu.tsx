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
import { personInitials, personName } from "@/lib/personName";
import { toast } from "sonner";
const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function SidebarUserMenu() {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();

  /**
   * The signed-in person, not a placeholder.
   *
   * This block used to be a hard-coded "John Fletcher / john@jobflow.io" while
   * `useAuth` sat two lines below, used only for sign-out — so every employer
   * saw a stranger's name and address in their own sidebar, and a shared screen
   * or a screenshot showed the same invented person to everyone.
   *
   * Where no name is known the email carries the row on its own. It is the one
   * thing we can be sure is theirs, and better than the email's local part
   * dressed up as a name. See lib/personName.
   */
  const name = personName(user);
  const initials = personInitials(user);
  const email = user?.email ?? "";
  const primary = name || email;
  const secondary = name ? email : "";

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
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
            <AvatarFallback className="rounded-lg  text-xs font-semibold">
              {/* Nothing to work from means a neutral icon, never fake letters. */}
              {initials || <CircleUser className="h-4 w-4" aria-hidden="true" />}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-sidebar-foreground leading-tight">
                  {primary || "Your account"}
                </p>
                {secondary && (
                  <p className="truncate text-[11px] text-muted-foreground leading-tight">
                    {secondary}
                  </p>
                )}
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
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
              <AvatarFallback className="rounded-lg  text-sm font-semibold">
                {initials || <CircleUser className="h-5 w-5" aria-hidden="true" />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {primary || "Your account"}
              </p>
              {secondary && (
                <p className="truncate text-xs text-muted-foreground">{secondary}</p>
              )}
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Upgrade CTA */}
       
        {/* Settings Group */}
        {/* Every item here goes somewhere that exists. "Account" used to point
            at /employers/account/settings, which no route matches — it fell
            through to the 404 page. There is no personal account page on the
            employer side yet, so the item is gone rather than pointed at the
            company record under a label that says "Account". */}
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => navigate("/employers/settings/general")}
          >
            <CircleUser className="h-4 w-4" />
            Company settings
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => navigate("/employers/billing")}
          >
            <CreditCard className="h-4 w-4" />
            Billing
          </DropdownMenuItem>
          {/* The notifications page, not the settings tab that configures them. */}
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => navigate("/employers/notifications")}
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
          onClick={() => navigate("/employers/contact")}
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
