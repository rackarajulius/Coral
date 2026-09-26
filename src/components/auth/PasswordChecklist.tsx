import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordChecklistProps {
  password: string;
}

const rules = [
  { label: "8+ characters", test: (p: string) => p.length >= 8 },
  { label: "1 uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "1 number", test: (p: string) => /[0-9]/.test(p) },
];

const PasswordChecklist = ({ password }: PasswordChecklistProps) => {
  if (!password) return null;

  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {rules.map(({ label, test }) => {
        const passed = test(password);
        return (
          <div
            key={label}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors duration-150",
              passed ? "text-emerald-500" : "text-muted-foreground/50",
            )}
          >
            {passed ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
};

export default PasswordChecklist;
