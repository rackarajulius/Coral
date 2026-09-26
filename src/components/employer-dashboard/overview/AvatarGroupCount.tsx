import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const AvatarGroupCount = ({
  avatars,
  total,
  iconColor,
}: {
  avatars: string[];
  total: number;
  iconColor: string;
}) => {
  const visible = avatars.slice(0, 3);
  const extra = Math.max(0, total - visible.length);
  return (
    <div
      className="flex items-center -space-x-2"
      role="img"
      aria-label={`${total} applicants`}
    >
      {visible.map((a, i) => {
        const isLast = i === visible.length - 1;
        return (
          <div key={i} className="relative h-8 w-8">
            <Avatar className="h-8 w-8 ring-2 ring-card" aria-hidden="true">
              <AvatarFallback className={cn("text-[10px] font-semibold bg-secondary", iconColor)}>
                {a}
              </AvatarFallback>
            </Avatar>
            {isLast && extra > 0 && (
              <div
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center"
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-full ring-2 ring-card flex items-center justify-center text-[10px] font-semibold bg-secondary/90 backdrop-blur-sm",
                    iconColor
                  )}
                >
                  +{extra}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AvatarGroupCount;
