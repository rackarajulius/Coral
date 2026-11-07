import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { accountSide } from "@/lib/accountSide";

/**
 * The employer side — marketing pages and the dashboard alike.
 *
 * One account does everything, as on LinkedIn: anyone may read the employer
 * pages and create or join a company from the account they already have. Who
 * may open the dashboard itself is EmployerAuthGate's question — a seat
 * answers it, not the account type. Freelancer accounts keep their own side
 * for now.
 *
 * It never blanks the page while auth is loading: signing in sets that flag
 * too, and hiding the page then would unmount the sign-in window mid-attempt.
 *
 * Team invitation links (/employers/join) are deliberately outside this gate:
 * that page names the company and explains a wrong-account problem itself.
 */
export default function EmployerAreaGate() {
  const { user } = useAuth();

  if (accountSide(user) === "provider") return <Navigate to="/provider" replace />;
  return <Outlet />;
}
