import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";

const FilterBar = () => {
    
 const FILTERS = [
  { id: "range", label: "Last 30 days", options: ["Last 7 days", "Last 30 days", "Last 90 days", "Year to date", "Custom"] },
  { id: "dept", label: "All Departments", options: ["All Departments", "Engineering", "Design", "Marketing", "Data", "Customer Success"] },
  { id: "job", label: "All Jobs", options: ["All Jobs", "Senior Backend Engineer", "Product Designer", "Engineering Manager"] },
  { id: "loc", label: "All Locations", options: ["All Locations", "Remote", "United States", "Europe", "APAC"] },
  { id: "team", label: "All Teams", options: ["All Teams", "Recruiting", "Hiring Managers", "Leadership"] },
  { id: "type", label: "All Types", options: ["All Types", "Full-time", "Part-time", "Contract", "Internship"] },
  { id: "source", label: "All Sources", options: ["All Sources", "Organic", "Direct", "Social", "Referral", "Paid"] },
];

  return (
     <div className="flex flex-wrap items-center gap-2">
      {FILTERS.map((f) => (
        <Select key={f.id} defaultValue={f.options[0]}>
          <SelectTrigger className="h-9 w-auto gap-2 border-outline border-gray-300 bg-card  text-xs font-medium text-foreground hover:bg-secondary">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {f.options.map((o) => (
              <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
    </div>
  );
};

export default FilterBar;
