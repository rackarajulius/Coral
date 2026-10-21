import { AlertTriangle, FileText, Loader2, Sparkles, Wand2 } from "lucide-react";
import { asksForCanadianExperience } from "@/lib/jobs/postingStatements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  FormControl, FormField, FormItem, FormMessage,
} from "@/components/ui/form";
import { EditJobFormReturn } from "@/data/employer/Jobs/types";

interface JobDescriptionSectionProps {
  form: EditJobFormReturn;
  aiLoading: string | null;
  onGenerate: () => void;
  onImprove: () => void;
}

const JobDescriptionSection = ({ form, aiLoading, onGenerate, onImprove }: JobDescriptionSectionProps) => (
  <Card className="shadow-card border border-gray-300">
    <CardHeader className="pb-4">
      <div className="flex items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" /> Job Description
        </CardTitle>
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={onGenerate}
            disabled={aiLoading === "description"}
          >
            {aiLoading === "description" ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1 text-amber-500" />
            )}
            Generate
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={onImprove}
            disabled={!!aiLoading}
          >
            {aiLoading === "improve" ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3 mr-1 text-violet-500" />
            )}
            Improve
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <div className="relative">
                <Textarea
                  className="min-h-[280px] font-mono text-sm leading-relaxed resize-y bg-card"
                  placeholder="Describe the role, responsibilities, and requirements..."
                  {...field}
                />
                {(aiLoading === "description" || aiLoading === "improve") && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm rounded-md flex items-center justify-center">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {aiLoading === "improve"
                        ? "AI is improving your description…"
                        : "AI is writing your description…"}
                    </div>
                  </div>
                )}
              </div>
            </FormControl>
            <div className="flex justify-between mt-1.5">
              <FormMessage />
              <span className="text-xs text-muted-foreground">
                {(field.value || "").length} characters
              </span>
            </div>
            {asksForCanadianExperience(field.value || "") && (
              // Advice, not a block: Coral can't tell whether the rule covers
              // this employer, but asking for it shuts out skilled newcomers anywhere.
              <p role="status" className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  This asks for Canadian experience. Ontario postings can't (since January 2026), and it turns away
                  qualified newcomers anywhere. Consider asking for the skills instead.
                </span>
              </p>
            )}
          </FormItem>
        )}
      />
    </CardContent>
  </Card>
);

export default JobDescriptionSection;
