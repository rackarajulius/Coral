import { cn } from "@/lib/utils";

interface IconButtonProps {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  className?: string;
}

export function IconButton({ icon: Icon, label, onClick, className }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        className
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}