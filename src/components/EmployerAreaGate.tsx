import { Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { RedirectWithNotice } from "@/components/auth/RedirectWithNotice";
import { SEEKER_ON_EMPLOYER_SIDE, accountSide } from "@/lib/accountSide";

/**
 * The employer side — marketing pages and the dashboard alike.
 *
 * A job seeker's account can't use any of it, so a signed-in job seeker is
 * sent back to the job seeker home with a short explanation, instead of
 * browsing employer pages under their own name. Everyone else passes:
 * visitors, employers, admins, and new accounts that haven't chosen a side
 * (opening these pages is how an employer signs up).
 *
 * It never blanks the page while auth is loading: signing in sets that flag
 * too, and hiding the page then would unmount the sign-in window mid-attempt.
 * The account is almost always known at once from the cached user.
 *
 * Team invitation links (/employers/join) are deliberately outside this gate:
 * that page names the company and explains a wrong-account problem itself.
 */
export default function EmployerAreaGate() {
  const { user } = useAuth();

  if (accountSide(user) === "seeker") {
    return <RedirectWithNotice to="/" message={SEEKER_ON_EMPLOYER_SIDE} />;
  }
  return <Outlet />;
}
