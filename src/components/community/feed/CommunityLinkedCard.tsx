import { ArrowUpRight, BriefcaseBusiness, Layers, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import type { CommunityLinkedRecord, PostPurpose } from "@/lib/api/community";
import { marketplaceMoney } from "@/lib/api/marketplace";

export const postPurposeLabels: Record<PostPurpose, string> = {
  general: "General",
  question: "Question",
  showcase: "Showcase",
  service_announcement: "Service announcement",
  opportunity: "Opportunity",
};

export function CommunityLinkedCard({ record, unavailable, postId }: { record?: CommunityLinkedRecord | null; unavailable?: boolean; postId?: string }) {
  if (!record) return unavailable ? (
    <div className="mt-3 rounded-xl border border-dashed border-border p-4">
      <p className="text-sm text-muted-foreground">This listing is no longer available.</p>
    </div>
  ) : null;
  const Icon = record.type === "service" ? Wrench : record.type === "project" ? Layers : BriefcaseBusiness;
  const price = listingPrice(record);
  const owner = record.company?.name || record.owner.displayName;
  const href = record.type !== "job" && postId ? `${record.url}?source=community&postId=${encodeURIComponent(postId)}` : record.url;
  return (
    <Link to={href} className="mt-3 block rounded-xl border border-border bg-muted/20 p-4 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span>{record.type === "service" ? "Service" : record.type === "project" ? "Project brief" : "Job"}</span>
        {record.category && <span className="capitalize">· {record.category.toLowerCase()}</span>}
      </div>
      <p className="mt-2 text-sm font-semibold">{record.title}</p>
      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{record.description}</p>
      {owner && <p className="mt-2 text-xs text-muted-foreground">{owner}</p>}
      {price && <p className="mt-2 text-sm font-medium">{price}</p>}
      <p className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">
        {record.type === "job" ? "View job and apply" : record.type === "service" ? "View service" : "View project brief"}
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      </p>
    </Link>
  );
}

function listingPrice(record: CommunityLinkedRecord): string | null {
  if (!record.currency) return null;
  const format = (minor: number) => marketplaceMoney(minor, record.currency);
  if (record.amountMinor != null) return `${format(record.amountMinor)}${record.pricingMode?.toLowerCase() === "hourly" ? " / hour" : ""}`;
  if (record.minBudgetMinor != null && record.maxBudgetMinor != null) return `${format(record.minBudgetMinor)} – ${format(record.maxBudgetMinor)}`;
  if (record.minBudgetMinor != null) return `From ${format(record.minBudgetMinor)}`;
  if (record.maxBudgetMinor != null) return `Up to ${format(record.maxBudgetMinor)}`;
  return record.pricingMode?.toLowerCase() === "quote" || record.budgetMode?.toLowerCase() === "negotiable" ? "Discuss scope and pricing" : null;
}
