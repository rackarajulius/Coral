import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { accountSide } from "@/lib/accountSide";
import { useAuth } from "@/contexts/AuthContext";

const TABS = [
  { to: "/jobs", label: "For you" },
  { to: "/resume-matcher", label: "Match my resume" },
] as const;

/**
 * The two ways to find work, as tabs across the top of both pages: the
 * listings with what's picked for you, and matching against your resume.
 * Plain words on a hairline, the current one underlined — the same quiet
 * strip Glassdoor uses for For You / Search.
 *
 * Not shown to employers: the matcher needs Premium, which is still a job
 * seeker plan, so the second tab would end at an upgrade they can't buy.
 */
export function JobsTabs() {
  const { user } = useAuth();
  if (accountSide(user) === "employer") return null;

  return (
    <nav aria-label="Find jobs" className="border-b border-border bg-card">
      <div className="container mx-auto flex h-12 items-stretch justify-center px-4 md:px-12 lg:px-24">
        <div className="flex items-stretch gap-6 sm:gap-8">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end
              className={({ isActive }) =>
                cn(
                  "relative flex items-center whitespace-nowrap text-sm transition-colors",
                  "after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-t-full after:transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2",
                  isActive
                    ? "font-semibold text-foreground after:bg-coral"
                    : "font-medium text-muted-foreground after:bg-transparent hover:text-foreground",
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default JobsTabs;
