import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Briefcase, X } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";

import { Burger, Drawer } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import ProfileMenu from "@/components/jobs/Navbar/ProfileMenu";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";

const Header = () => {
    const { isAuthenticated } = useAuth();
    const { openAuth } = useAuthModal();
  const [opened, { open, close }] = useDisclosure(false);
   
   
   



  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-secondary border-b border-border sm:px-6 md:px-8">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4 ">
          <Link to="/" className="flex items-center gap-2 text-primary font-display font-bold text-xl">
            <Briefcase className="h-6 w-6 text-coral" />
            <span className="text-2xl font-semibold tracking-tight">JobFlow</span>
          </Link>
          
          <nav className="hidden bs-mx:!hidden lg:flex xl:gap-4 items-center gap-6">
            <Link to="/jobs" className="nav-link font-medium text-muted-foreground hover:text-foreground transition-colors">
              Find Jobs
            </Link>
            <Link to="/companies" className="nav-link font-medium text-muted-foreground hover:text-foreground transition-colors">
              Companies
            </Link>
            <Link to="/community" className="nav-link font-medium text-muted-foreground hover:text-foreground transition-colors">
              Community
            </Link>
            <Link to="/employers" className="nav-link font-medium text-muted-foreground hover:text-foreground transition-colors">
             For Employers
            </Link>
            <Link to="/resources" className="nav-link font-medium text-muted-foreground hover:text-foreground transition-colors">
              Resources
            </Link>
          </nav>
         </div>


          <div className="flex items-center gap-4">
          {isAuthenticated && (
            <NotificationBell className="p-2 rounded-full bg-card hover:bg-muted" iconClassName="w-5 h-5" />
          )}

            {!isAuthenticated && (
              <Button variant="outline" onClick={() => openAuth()}>
                Sign In
              </Button>
            )}

             <div className="hidden lg:flex items-center gap-2">
              <span className="text-muted-foreground mx-2">|</span>
               <Button variant="default" asChild>
                <Link to="/employers">Post Job | Employer</Link>
                </Button>
             </div>

              <div className=" flex items-center gap-2 sm:gap-3">
              <ProfileMenu />
              </div>

               {/* Mobile Menu Button */}
               <div className="lg:hidden">
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
        className="lg:hidden"
      >
          <div className="flex flex-col gap-6 mt-6 px-4">
            <div className="border-b border-border pb-3 last:border-b-0">
              <Link to="/jobs" className="nav-link text-sm text-muted-foreground hover:text-foreground transition-colors">
                Find Jobs
              </Link>
            </div>
            <div className="border-b border-border pb-3 last:border-b-0">
              <Link to="/home" className="nav-link text-sm text-muted-foreground hover:text-foreground transition-colors">
                For Employers
              </Link>
            </div>
            <div className="border-b border-border pb-3 last:border-b-0">
              <Link to="/resources" className="nav-link text-sm text-muted-foreground hover:text-foreground transition-colors">
                Resources
              </Link>
            </div>

            {/* Mobile Login / Sign Up */}
            {!isAuthenticated && (
              <div className="flex flex-col gap-3 pt-4">
                <Button variant="outline" size="sm" onClick={() => { close(); openAuth(); }}>
                  Log In
                </Button>
                <Button variant="default" size="sm" onClick={() => { close(); openAuth({ view: "signup" }); }}>
                  Sign Up
                </Button>
              </div>
            )}
              </div>
            <div>
          </div>
      </Drawer>
    </header>
  );
};

export default Header;
