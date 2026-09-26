import { useState } from "react";
import { toast } from "sonner";
import { Tag, Plus, X, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EditJobFormReturn, FieldArrayItem, suggestedSkills } from "@/data/employer/Jobs/types";
import { UseFieldArrayAppend, UseFieldArrayRemove } from "react-hook-form";
import { EditJobForm } from "@/data/employer/Jobs/types";

interface SkillsSectionProps {
  form: EditJobFormReturn;
  fields: FieldArrayItem[];
  append: UseFieldArrayAppend<EditJobForm, "skills">;
  remove: UseFieldArrayRemove;
  aiLoading: string | null;
  onSuggest: () => void;
  showSuggestions: boolean;
  setShowSuggestions: (v: boolean) => void;
}

const SkillsSection = ({
  form, fields, append, remove, aiLoading, onSuggest, showSuggestions, setShowSuggestions,
}: SkillsSectionProps) => {
  const [skillInput, setSkillInput] = useState("");

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (!trimmed) return;
    if (fields.some((f) => (f.value ?? "").toLowerCase() === trimmed.toLowerCase())) {
      toast(`"${trimmed}" is already added`, { duration: 2000 });
      setSkillInput("");
      return;
    }
    append({ value: trimmed });
    setSkillInput("");
  };

  const filtered = suggestedSkills.filter(
    (s) => !fields.some((f) => (f.value ?? "").toLowerCase() === s.toLowerCase())
  );

  return (
    <Card className="shadow-card border border-gray-300">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" /> Skills & Requirements
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={onSuggest}
            disabled={!!aiLoading}
          >
            {aiLoading === "skills" ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1 text-amber-500" />
            )}
            Suggest Skills
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
            placeholder="Add a skill…"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill(skillInput);
              }
            }}
            className="flex-1 bg-card"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => addSkill(skillInput)} disabled={!skillInput.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {showSuggestions && filtered.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> AI Suggestions
              </span>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 text-amber-700 dark:text-amber-400"
                  onClick={() => {
                    filtered.forEach((s) => append({ value: s }));
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
              {filtered.map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-xs border-amber-300 dark:border-amber-700"
                  onClick={() => append({ value: s })}
                >
                  <Plus className="h-2.5 w-2.5 mr-1" /> {s}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {form.formState.errors.skills && (
          <p className="text-sm text-destructive">{form.formState.errors.skills.message}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default SkillsSection;
