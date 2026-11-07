import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { getCompanyPageStatus } from "@/lib/api/companyTeam";
import { COMPANY_PAGE_STATUS_KEY } from "@/components/employer-dashboard/settings/PageStatusCard";

/**
 * Says so on the dashboard when the company page is down — otherwise a
 * recruiter only finds out when posting a job is refused.
 */
export function PageDeactivatedNotice() {
  const { data: status } = useQuery({
    queryKey: COMPANY_PAGE_STATUS_KEY,
    queryFn: getCompanyPageStatus,
    retry: false,
  });
  if (!status?.deactivatedAt) return null;

  return (
    <section
      aria-label="Company page deactivated"
      className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5"
    >
      <h2 className="text-sm font-semibold text-foreground">
        {status.companyName || "Your company"}'s page is deactivated
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Visitors can't see it, and nobody can post jobs or contact candidates until it's reactivated.
        {status.deletesAt
          ? ` It will be deleted for good on ${new Date(status.deletesAt).toLocaleDateString(undefined, { dateStyle: "long" })}.`
          : ""}
        {status.canManage ? "" : " Your company's owner can reactivate it."}
      </p>
      {status.canManage && (
        <Link
          to="/employers/settings/general"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Reactivate it in Settings <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

export default PageDeactivatedNotice;
