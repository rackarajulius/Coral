import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Briefcase, X } from "lucide-react";

import { Burger, Drawer } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import ProfileMenu from "./ProfileMenu";
import NotificationBell from "./NotificationBell";
import { accountSide } from "@/lib/accountSide";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { BRAND_NAME } from "@/lib/brand";
import { COMMUNITY_TAB } from "@/lib/communityTab";

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
            <Link to="/providers" target={COMMUNITY_TAB} className="nav-link text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Professionals
            </Link>
            <Link to="/community" target={COMMUNITY_TAB} className="nav-link text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
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
          <NotificationBell />

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
              <Link to="/providers" target={COMMUNITY_TAB} onClick={close} className="nav-link text-sm text-muted-foreground hover:text-foreground">
                Find professionals
              </Link>
            </div>
            <div className="border-b border-border pb-3">
              <Link to="/community" target={COMMUNITY_TAB} onClick={close} className="nav-link text-sm text-muted-foreground hover:text-foreground">
                Community
              </Link>
            </div>
            {(!user || side === 'seeker' || side === 'provider' || side === 'undecided') && (
              <div className="border-b border-border pb-3">
                <Link to="/provider" target={COMMUNITY_TAB} onClick={close} className="nav-link text-sm text-muted-foreground hover:text-foreground">
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
