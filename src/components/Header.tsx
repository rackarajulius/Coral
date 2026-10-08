import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bell, Briefcase, X } from "lucide-react";

import { Burger, Drawer } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProfileMenu from "./ProfileMenu";
import { accountSide } from "@/lib/accountSide";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { BRAND_NAME } from "@/lib/brand";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationsResponse,
} from "@/lib/api/notifications";

const NOTIFICATIONS_KEY = ["notifications"] as const;

function relativeTime(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

const Header = () => {
    const { isAuthenticated, isLoading, user } = useAuth();
    const { openAuth } = useAuthModal();
    // The employer link depends on who is looking: nothing for a job seeker
    // (their account can't use the employer side), the dashboard for an
    // employer, the employer site for everyone else.
    const side = accountSide(user);
    const employerLink =
      side === "seeker" || side === "provider"
        ? null
        : side === "employer"
          ? { to: "/employers/dashboard", label: "Employer dashboard" }
          : { to: "/employers", label: "For Employers" };
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);

    // Real notifications for the signed-in user (polled while mounted).
    const { data: notificationsData } = useQuery({
      queryKey: NOTIFICATIONS_KEY,
      queryFn: getMyNotifications,
      enabled: isAuthenticated,
      staleTime: 30_000,
      refetchInterval: 60_000,
    });
    const notifications = notificationsData?.data ?? [];
    const unreadCount = notificationsData?.unreadCount ?? 0;

    const markReadMut = useMutation({
      mutationFn: (id: string) => markNotificationRead(id),
      onMutate: async (id) => {
        await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
        const prev = queryClient.getQueryData<NotificationsResponse>(NOTIFICATIONS_KEY);
        queryClient.setQueryData<NotificationsResponse>(NOTIFICATIONS_KEY, (old) =>
          old
            ? {
                data: old.data.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
                unreadCount: old.data.some((n) => n.id === id && !n.readAt)
                  ? Math.max(0, old.unreadCount - 1)
                  : old.unreadCount,
              }
            : old,
        );
        return { prev };
      },
      onError: (_e, _id, ctx) => ctx?.prev && queryClient.setQueryData(NOTIFICATIONS_KEY, ctx.prev),
      onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
    });

    const markAllMut = useMutation({
      mutationFn: () => markAllNotificationsRead(),
      onMutate: async () => {
        await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
        const prev = queryClient.getQueryData<NotificationsResponse>(NOTIFICATIONS_KEY);
        queryClient.setQueryData<NotificationsResponse>(NOTIFICATIONS_KEY, (old) =>
          old
            ? { data: old.data.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })), unreadCount: 0 }
            : old,
        );
        return { prev };
      },
      onError: (_e, _v, ctx) => ctx?.prev && queryClient.setQueryData(NOTIFICATIONS_KEY, ctx.prev),
      onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
    });

    const markAllAsRead = () => markAllMut.mutate();
   
  const [opened, { open, close }] = useDisclosure(false);
   
   
   



  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-card border-b border-border sm:px-6 md:px-8">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4 ">
          <Link to="/" className="flex items-center gap-2 text-primary font-display font-bold text-xl">
            <Briefcase className="h-6 w-6 text-coral" />
            <span className="text-2xl font-semibold tracking-tight">{BRAND_NAME}</span>
          </Link>
          
          <nav className="hidden xl:flex items-center gap-6 whitespace-nowrap">
            <Link to="/jobs" className="nav-link text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Find Jobs
            </Link>
            <Link to="/companies" className="nav-link text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Companies
            </Link>
            <Link to="/providers" className="nav-link text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Professionals
            </Link>
            <Link to="/community" className="nav-link text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Community
            </Link>

            <Link to="/resources" className="nav-link text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Resources
            </Link>
            {employerLink && (
              <Link to={employerLink.to} className="nav-link text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                {employerLink.label}
              </Link>
            )}
          </nav>
         </div>


          <div className="flex items-center gap-4">
          {/* Notifications — only for signed-in users. */}
          {isAuthenticated && (
          <div className="relative">
    <button
      onClick={() => setIsOpen(!isOpen)}
      aria-label="Notifications"
      aria-expanded={isOpen}
      className="relative p-2 rounded-full hover:bg-muted transition-colors"
    >
      <Bell className="w-5 h-5 text-muted-foreground" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5
         px-1 text-xs font-semibold text-white bg-coral rounded-full">
          {unreadCount}
        </span>
      )}
    </button>

    {isOpen && (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
        
        {/* Notification Panel - Desktop: Dropdown, Mobile: Full Screen */}
        <div className="fixed inset-x-0 bottom-0 h-[100dvh] max-h-none sm:absolute sm:h-auto sm:max-h-[32rem] 
         sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 w-full sm:w-96 bg-card border border-border
         rounded-t-lg sm:rounded-lg shadow-lg z-50 flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <h3 className="font-semibold text-base sm:text-sm">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-xs text-muted-foreground hover:text-coral transition-colors"
                >
                  Mark all read
                </button>
              )}
              {/* Close button for mobile */}
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
                className="sm:hidden p-1 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 sm:p-6 text-center text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-border last:border-b-0 hover:bg-coral/10 active:bg-coral/20
                     cursor-pointer transition-colors ${
                    !notification.readAt ? 'bg-coral/5' : ''
                  }`}
                  onClick={() => {
                    if (!notification.readAt) markReadMut.mutate(notification.id);
                    if (notification.link) {
                      setIsOpen(false);
                      navigate(notification.link);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{notification.title}</p>
                        {!notification.readAt && (
                          <span className="w-2 h-2 bg-coral rounded-full shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {relativeTime(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    )}
  </div>
          )}

              {/* While auth is still resolving on refresh, show a neutral avatar
                  placeholder — never the Sign In button — so it doesn't flash. */}
              {isLoading ? (
                <div
                  className="h-8 w-8 rounded-full bg-muted animate-pulse"
                  aria-hidden="true"
                />
              ) : isAuthenticated ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <ProfileMenu />
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="border-none hover:bg-muted hover:text-foreground"
                  onClick={() => openAuth()}
                >
                  Sign In
                </Button>
              )}

               {/* Mobile Menu Button */}
               <div className="xl:hidden">
               <Burger
               opened={opened}
               onClick={open}
               aria-label="Toggle navigation"
               size="sm"
               />
              </div>
          </div>
        </div>
      </div>

      
       {/* === Mobile Drawer === */}
       <Drawer
        size="xs"
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
        position="right"
        opened={opened}
        onClose={close}
        closeButtonProps={{ icon: < X size={20} /> }}
        className="xl:hidden"
      >
          <div className="flex flex-col gap-6 mt-6 px-4">
            <div className="border-b border-border pb-3 last:border-b-0">
              <Link to="/jobs" onClick={close} className="nav-link text-sm text-muted-foreground hover:text-foreground transition-colors">
                Find Jobs
              </Link>
            </div>

            <div className="border-b border-border pb-3 last:border-b-0">
              <Link to="/resources" onClick={close} className="nav-link text-sm text-muted-foreground hover:text-foreground transition-colors">
                Resources
              </Link>
            </div>

            <div className="border-b border-border pb-3">
              <Link to="/companies" onClick={close} className="nav-link text-sm text-muted-foreground hover:text-foreground">
                Companies
              </Link>
            </div>

            <div className="border-b border-border pb-3">
              <Link to="/providers" onClick={close} className="nav-link text-sm text-muted-foreground hover:text-foreground">
                Find professionals
              </Link>
            </div>
            <div className="border-b border-border pb-3">
              <Link to="/community" onClick={close} className="nav-link text-sm text-muted-foreground hover:text-foreground">
                Community
              </Link>
            </div>
            {(!user || side === 'seeker' || side === 'provider' || side === 'undecided') && (
              <div className="border-b border-border pb-3">
                <Link to="/provider" onClick={close} className="nav-link text-sm text-muted-foreground hover:text-foreground">
                  Offer services
                </Link>
              </div>
            )}

            {employerLink && (
              <div className="border-b border-border pb-3 last:border-b-0">
                <Link to={employerLink.to} onClick={close} className="nav-link text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {employerLink.label}
                </Link>
              </div>
            )}

            {/* Mobile Login / Sign Up */}
              <div className="flex flex-col gap-3 pt-4">
{!isAuthenticated && (
  <Button variant="ghost" size="sm" className="hover:bg-muted hover:text-foreground hover:opacity-100" onClick={() => { close(); openAuth(); }}>
    Sign In
  </Button>
)}
              </div>
              </div>
            <div>
          </div>
      </Drawer>
    </header>
  );
};

export default Header;
