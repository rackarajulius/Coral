import { AlertTriangle, DollarSign, Info } from "lucide-react";
import { PAY_RANGE_MAX_SPREAD, looksOntario, payRangeTooWide } from "@/lib/jobs/postingStatements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { EditJobFormReturn } from "@/data/employer/Jobs/types";

interface SalarySectionProps {
  form: EditJobFormReturn;
}

const SalarySection = ({ form }: SalarySectionProps) => (
  <Card className="shadow-card border border-gray-300">
    <CardHeader className="pb-4">
      <CardTitle className="text-base flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-muted-foreground" /> Salary & Compensation
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="salaryMin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Minimum Salary</FormLabel>
              <FormControl>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="number" className="pl-9 bg-card" placeholder="150,000" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="salaryMax"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Maximum Salary</FormLabel>
              <FormControl>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="number" className="pl-9 bg-card" placeholder="220,000" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="currency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Currency</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="CAD">CAD (C$)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="payType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pay Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="yearly">Per Year</SelectItem>
                  <SelectItem value="monthly">Per Month</SelectItem>
                  <SelectItem value="hourly">Per Hour</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <PayGuidance form={form} />
    </CardContent>
  </Card>
);

/**
 * A word about pay, when there's something to say: postings that state it
 * get more applicants, and Ontario postings must (with a range no wider than
 * $50,000). Advice only — Coral can't tell whether the rule covers this
 * employer, so it never blocks the posting.
 */
const PayGuidance = ({ form }: SalarySectionProps) => {
  const [min, max, period, location] = form.watch(["salaryMin", "salaryMax", "payType", "location"]);
  const ontario = looksOntario(location ?? "");
  const salaryMin = Number(min) || 0;
  const salaryMax = Number(max) || 0;

  if (!salaryMin && !salaryMax) {
    return (
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          Postings that state pay get more applicants, and your company page counts how many of your roles do.
          {ontario && " In Ontario, employers with 25 or more employees must state a pay figure or range."}
        </span>
      </p>
    );
  }
  if (ontario && payRangeTooWide(salaryMin, salaryMax, period ?? "")) {
    return (
      <p role="status" className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-500">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          This range is more than ${PAY_RANGE_MAX_SPREAD.toLocaleString()} wide. Ontario limits posted ranges to that
          for roles paying up to $200,000 a year.
        </span>
      </p>
    );
  }
  return null;
};

export default SalarySection;
