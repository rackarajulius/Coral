import { useState } from "react";
import { Plus, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { ValidationErrors } from "@/data/admin/job/job-validation";

interface ApplicationSettingsSectionProps {
  applicationMethod: "platform" | "external" | "";
  onMethodChange: (method: "platform" | "external") => void;
  externalUrl: string;
  onExternalUrlChange: (url: string) => void;
  deadline: string;
  onDeadlineChange: (date: string) => void;
  screeningQuestions: string[];
  onScreeningQuestionsChange: (questions: string[]) => void;
  errors: ValidationErrors;
  onBlurField: (field: string) => void;
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-destructive mt-1">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {error}
    </p>
  );
}

function ValidIcon() {
  return <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />;
}

export function ApplicationSettingsSection({
  applicationMethod,
  onMethodChange,
  externalUrl,
  onExternalUrlChange,
  deadline,
  onDeadlineChange,
  screeningQuestions,
  onScreeningQuestionsChange,
  errors,
  onBlurField,
}: ApplicationSettingsSectionProps) {
  const [questionInput, setQuestionInput] = useState("");

  const addQuestion = () => {
    const trimmed = questionInput.trim();
    if (trimmed.length >= 5) {
      onScreeningQuestionsChange([...screeningQuestions, trimmed]);
      setQuestionInput("");
    }
  };

  const removeQuestion = (index: number) => {
    onScreeningQuestionsChange(screeningQuestions.filter((_, i) => i !== index));
  };

  const isUrlValid =
    applicationMethod === "external" &&
    externalUrl.trim() !== "" &&
    !errors.externalUrl;

  return (
    <section id="application-settings-section">
      <h2 className="text-lg font-semibold text-foreground mb-4">Application Settings</h2>
      <div className="space-y-5">
        {/* Application Method - Radio Group */}
        <div>
          <Label className="text-sm font-medium">
            Application Method <span className="text-destructive">*</span>
          </Label>
          <RadioGroup
            value={applicationMethod}
            onValueChange={(v) => onMethodChange(v as "platform" | "external")}
            className={`mt-2 space-y-2 rounded-lg border p-3 bg-card ${
              errors.applicationMethod
                ? "border-destructive/50"
                : "border-border"
            }`}
          >
            <div className="flex items-center space-x-3 ">
              <RadioGroupItem value="platform" id="method-platform" />
              <div>
                <Label htmlFor="method-platform" className="text-sm cursor-pointer">
                  Apply on Platform
                </Label>
                <p className="text-xs text-muted-foreground">
                  Candidates apply through JobBoard.io
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="external" id="method-external" />
              <Label htmlFor="method-external" className="text-sm cursor-pointer">
                External Application URL
              </Label>
            </div>
          </RadioGroup>
          <FieldError error={errors.applicationMethod} />
        </div>

        {/* External URL field */}
        {applicationMethod === "external" && (
          <div>
            <Label className="text-sm">
              External Application URL <span className="text-destructive">*</span>
            </Label>
            <div className="relative mt-1.5">
              <Input
                placeholder="https://careers.example.com/apply"
                value={externalUrl}
                onChange={(e) => onExternalUrlChange(e.target.value)}
                onBlur={() => onBlurField("externalUrl")}
                className={`h-11 pr-9 ${
                  errors.externalUrl ? "border-destructive/50 focus-visible:ring-destructive/30" : ""
                }`}
              />
              {isUrlValid && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <ValidIcon />
                </div>
              )}
            </div>
            <FieldError error={errors.externalUrl} />
          </div>
        )}

        {/* Application Deadline */}
        <div>
          <Label className="text-sm">Application Deadline</Label>
          <Input
            type="date"
            value={deadline}
            onChange={(e) => onDeadlineChange(e.target.value)}
            onBlur={() => onBlurField("deadline")}
            className={`mt-1.5 h-11 w-full sm:w-64 ${
              errors.deadline ? "border-destructive/50 focus-visible:ring-destructive/30" : ""
            }`}
          />
          <FieldError error={errors.deadline} />
        </div>

        {/* Auto-reject */}
        <div className="flex items-center gap-3">
          <Switch id="auto-reject" />
          <Label htmlFor="auto-reject" className="text-sm text-muted-foreground">
            Auto-reject unqualified applicants
          </Label>
        </div>

      </div>
    </section>
  );
}
