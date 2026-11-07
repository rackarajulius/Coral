import { ScrollText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { EditJobFormReturn } from "@/data/employer/Jobs/types";

interface PostingStatementsSectionProps {
  form: EditJobFormReturn;
  /**
   * Coral's AI has already screened this job's applicants, so the posting
   * must keep saying AI is used. The server refuses to clear it too.
   */
  aiLocked?: boolean;
}

/**
 * Two things the posting says about itself: whether the role is open now,
 * and whether AI helps decide who goes forward. Candidates see both on the
 * posting, and they count toward the checked commitments on the company page.
 */
const PostingStatementsSection = ({ form, aiLocked = false }: PostingStatementsSectionProps) => (
  <Card className="shadow-card border border-gray-300">
    <CardHeader className="pb-4">
      <CardTitle className="text-base flex items-center gap-2">
        <ScrollText className="h-4 w-4 text-muted-foreground" /> What the posting states
      </CardTitle>
      <p className="text-sm text-muted-foreground">
        Shown on the posting. Ontario has required both in public postings since January 2026 (employers with 25 or
        more employees), and candidates anywhere want to know.
      </p>
    </CardHeader>
    <CardContent className="space-y-5">
      <FormField
        control={form.control}
        name="existingVacancy"
        render={({ field }) => (
          <FormItem className="space-y-2">
            <FormLabel>Is this role open now?</FormLabel>
            <FormControl>
              <RadioGroup value={field.value} onValueChange={field.onChange} className="gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="open" /> Yes, it's open now
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="future" /> No, we're gathering candidates for future openings
                </label>
              </RadioGroup>
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="usesAi"
        render={({ field }) => (
          <FormItem className="space-y-1.5">
            <label className={`flex items-start gap-2 text-sm ${aiLocked ? "" : "cursor-pointer"}`}>
              <FormControl>
                <Checkbox
                  checked={field.value || aiLocked}
                  disabled={aiLocked}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  className="mt-0.5"
                />
              </FormControl>
              <span>We use AI to screen, assess or select applicants for this role</span>
            </label>
            <p className="text-xs text-muted-foreground pl-6">
              {aiLocked
                ? "Stays on: Coral's AI has screened applicants for this job, so the posting has to keep saying so."
                : "Coral turns this on for you when its AI scores this job's applicants in a written or live screening round."}
            </p>
          </FormItem>
        )}
      />
    </CardContent>
  </Card>
);

export default PostingStatementsSection;
