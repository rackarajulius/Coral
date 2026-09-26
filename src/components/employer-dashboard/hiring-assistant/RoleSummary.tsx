import { Briefcase, MapPin, DollarSign, Clock, Users } from "lucide-react";
import type { ParsedIntent, RoleType, Seniority } from "@/data/employer/HiringAssistant/Index";

// ─── Label helpers ────────────────────────────────────────────────────────────

const SENIORITY_LABEL: Record<Seniority, string> = {
  junior:    "Junior · IC1",
  mid:       "Mid-level · IC2",
  senior:    "Senior · IC4",
  staff:     "Staff · IC5",
  lead:      "Tech Lead · IC5",
  principal: "Principal · IC6",
  executive: "Executive · Director+",
};

const SALARY: Record<RoleType, Record<Seniority, string>> = {
  frontend:   { junior: "$90k–$120k", mid: "$130k–$160k", senior: "$175k–$240k", staff: "$210k–$270k", lead: "$200k–$265k", principal: "$230k–$290k", executive: "$280k+" },
  backend:    { junior: "$95k–$125k", mid: "$135k–$165k", senior: "$165k–$225k", staff: "$200k–$260k", lead: "$195k–$255k", principal: "$225k–$285k", executive: "$275k+" },
  fullstack:  { junior: "$90k–$120k", mid: "$130k–$160k", senior: "$160k–$220k", staff: "$200k–$260k", lead: "$195k–$255k", principal: "$225k–$285k", executive: "$270k+" },
  design:     { junior: "$80k–$110k", mid: "$120k–$150k", senior: "$145k–$200k", staff: "$185k–$240k", lead: "$175k–$230k", principal: "$200k–$260k", executive: "$250k+" },
  sales:      { junior: "$60k–$80k",  mid: "$90k–$120k",  senior: "$120k–$160k", staff: "$150k–$190k", lead: "$140k–$180k", principal: "$170k–$210k", executive: "$200k+" },
  marketing:  { junior: "$65k–$85k",  mid: "$95k–$125k",  senior: "$130k–$175k", staff: "$160k–$200k", lead: "$155k–$195k", principal: "$180k–$220k", executive: "$220k+" },
  data:       { junior: "$95k–$125k", mid: "$135k–$165k", senior: "$160k–$215k", staff: "$200k–$255k", lead: "$195k–$250k", principal: "$220k–$275k", executive: "$270k+" },
  product:    { junior: "$95k–$120k", mid: "$130k–$165k", senior: "$160k–$220k", staff: "$200k–$260k", lead: "$195k–$255k", principal: "$225k–$280k", executive: "$270k+" },
  management: { junior: "$130k–$160k", mid: "$160k–$200k", senior: "$200k–$250k", staff: "$230k–$285k", lead: "$220k–$275k", principal: "$250k–$310k", executive: "$280k+" },
  general:    { junior: "$80k–$110k", mid: "$110k–$145k", senior: "$140k–$190k", staff: "$175k–$230k", lead: "$170k–$220k", principal: "$200k–$255k", executive: "$240k+" },
};

const REPORTS_TO: Record<RoleType, string> = {
  frontend:   "Reports to VP Eng",
  backend:    "Reports to VP Eng",
  fullstack:  "Reports to VP Eng",
  design:     "Reports to Head of Design",
  sales:      "Reports to CRO",
  marketing:  "Reports to CMO",
  data:       "Reports to Head of Data",
  product:    "Reports to CPO",
  management: "Reports to VP / CTO",
  general:    "Reports to Director",
};

function buildChips(intent: ParsedIntent) {
  const salary = SALARY[intent.roleType]?.[intent.seniority] ?? "$130k–$180k";
  const seniorityLabel = SENIORITY_LABEL[intent.seniority] ?? "Senior · IC4";
  const locationLabel = intent.remote
    ? "Remote · Worldwide"
    : intent.location
      ? intent.location.charAt(0).toUpperCase() + intent.location.slice(1)
      : "Flexible location";

  return [
    { icon: Briefcase,  label: seniorityLabel },
    { icon: MapPin,     label: locationLabel },
    { icon: DollarSign, label: `${salary} + equity` },
    { icon: Clock,      label: "Active · 30 days" },
    { icon: Users,      label: REPORTS_TO[intent.roleType] },
  ];
}

const DEFAULT_CHIPS = [
  { icon: Briefcase,  label: "Senior · IC4" },
  { icon: MapPin,     label: "Remote · US/CA" },
  { icon: DollarSign, label: "$180k–$240k + equity" },
  { icon: Clock,      label: "Urgent · 30 days" },
  { icon: Users,      label: "Reports to VP Eng" },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface RoleSummaryProps {
  intent: ParsedIntent | null;
}

export function RoleSummary({ intent }: RoleSummaryProps) {
  const chips = intent ? buildChips(intent) : DEFAULT_CHIPS;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span
            key={chip.label}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border
                       bg-secondary/60 px-2.5 py-1.5 text-xs font-medium text-foreground"
          >
            <chip.icon className="h-3.5 w-3.5 text-muted-foreground" />
            {chip.label}
          </span>
        ))}
      </div>
    </div>
  );
}
