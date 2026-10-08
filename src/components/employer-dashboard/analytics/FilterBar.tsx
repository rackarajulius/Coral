import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAnalyticsRange } from "./AnalyticsRange";

export default function FilterBar() {
  const { days, setDays } = useAnalyticsRange();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="analytics-range" className="text-xs text-muted-foreground">Reporting period</label>
      <Select value={String(days)} onValueChange={(value) => setDays(Number(value) as 7 | 30 | 90)}>
        <SelectTrigger id="analytics-range" className="h-9 w-40 border-gray-300 bg-card text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7">Last 7 days</SelectItem>
          <SelectItem value="30">Last 30 days</SelectItem>
          <SelectItem value="90">Last 90 days</SelectItem>
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">Applies to activity, traffic, jobs and reach. Snapshot cards use their own periods.</span>
    </div>
  );
}
