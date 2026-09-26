import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FeedItemProps {
  icon: any;
  title: string;
  desc: string;
  category: string;
  time: string;
  color: string;
  onDismiss: () => void;
  /** Only rendered when the item actually links somewhere. */
  onView?: () => void;
}

const FeedItem = ({ icon: Icon, title, desc, category, time, color, onDismiss, onView }: FeedItemProps) => (
  <li className="p-5 hover:bg-secondary/40 transition-colors group">
    <div className="flex items-start gap-4">
      <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <Badge variant="secondary" className="text-[10px] rounded-full">{category}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{desc}</p>
        <div className="flex items-center gap-2 mt-3">
          {onView && (
            <Button size="sm" className="h-8 text-xs" onClick={onView}>View</Button>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onDismiss}>Dismiss</Button>
        </div>
      </div>
      <span className="hidden sm:block text-xs text-muted-foreground shrink-0 whitespace-nowrap">{time}</span>
    </div>
  </li>
);

export default FeedItem;
