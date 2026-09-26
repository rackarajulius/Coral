import { cn } from "@/lib/utils";

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const AuthInput = ({ label, error, id, className, ...props }: AuthInputProps) => {
  const errorId = error && id ? `${id}-error` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          "flex h-10 w-full rounded-xl border border-gray-300 bg-auth-input px-4 text-sm text-foreground placeholder:text-muted-foreground/50 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-destructive/60 focus:ring-destructive/30",
          className,
        )}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-xs text-destructive/80 mt-1">
          {error}
        </p>
      )}
    </div>
  );
};

export default AuthInput;
