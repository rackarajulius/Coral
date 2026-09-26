import { useState } from "react";
import { toast } from "sonner";
import { Gift, Plus, X, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FieldArrayItem, suggestedBenefits, EditJobForm } from "@/data/employer/Jobs/types";
import { UseFieldArrayAppend, UseFieldArrayRemove } from "react-hook-form";

interface BenefitsSectionProps {
  fields: FieldArrayItem[];
  append: UseFieldArrayAppend<EditJobForm, "benefits">;
  remove: UseFieldArrayRemove;
  aiLoading: string | null;
  onSuggest: () => void;
  showSuggestions: boolean;
  setShowSuggestions: (v: boolean) => void;
}

const BenefitsSection = ({
  fields, append, remove, aiLoading, onSuggest, showSuggestions, setShowSuggestions,
}: BenefitsSectionProps) => {
  const [benefitInput, setBenefitInput] = useState("");

  const addBenefit = (benefit: string) => {
    const trimmed = benefit.trim();
    if (!trimmed) return;
    if (fields.some((f) => (f.value ?? "").toLowerCase() === trimmed.toLowerCase())) {
      toast(`"${trimmed}" is already added`, { duration: 2000 });
      setBenefitInput("");
      return;
    }
    append({ value: trimmed });
    setBenefitInput("");
  };

  const filtered = suggestedBenefits.filter(
    (s) => !fields.some((f) => (f.value ?? "").toLowerCase() === s.toLowerCase())
  );

  return (
    <Card className="shadow-card border border-gray-300">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4 text-muted-foreground" /> Benefits & Perks
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={onSuggest}
            disabled={!!aiLoading}
          >
            {aiLoading === "benefits" ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1 text-amber-500" />
            )}
            Suggest Benefits
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {fields.map((field, index) => (
            <Badge
              key={field.id}
              variant="secondary"
              className="pl-3 pr-1.5 py-1.5 text-sm gap-1.5 bg-secondary hover:bg-secondary/80"
            >
              {field.value ?? ""}
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded-full hover:bg-destructive/20 p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Add a benefit…"
            value={benefitInput}
            onChange={(e) => setBenefitInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addBenefit(benefitInput);
              }
            }}
            className="flex-1 bg-card"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => addBenefit(benefitInput)} disabled={!benefitInput.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {showSuggestions && filtered.length > 0 && (
          <div className="p-3 rounded-xl bg-violet-50/50 dark:bg-violet-900/10 border border-violet-200/50 dark:border-violet-800/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-violet-700 dark:text-violet-400 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> AI Suggestions
              </span>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 text-violet-700 dark:text-violet-400"
                  onClick={() => {
                    filtered.forEach((b) => append({ value: b }));
                    setShowSuggestions(false);
                  }}
                >
                  Add All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6"
                  onClick={() => setShowSuggestions(false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {filtered.map((b) => (
                <Badge
                  key={b}
                  variant="outline"
                  className="cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors text-xs border-violet-300 dark:border-violet-700"
                  onClick={() => append({ value: b })}
                >
                  <Plus className="h-2.5 w-2.5 mr-1" /> {b}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BenefitsSection;
