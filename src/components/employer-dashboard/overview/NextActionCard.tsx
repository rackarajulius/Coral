import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface NextActionCardProps {
  icon: any;
  title: string;
  desc: string;
  cta: string;
  to: string;
  highlight?: boolean;
}

const NextActionCard = ({ icon: Icon, title, desc, cta, to, highlight }: NextActionCardProps) => (
  <div
    className={cn(
      "rounded-2xl border p-5 transition-all duration-300 hover:shadow-md",
      highlight
        ? "bg-gradient-to-br from-gray-100 to-white border-gray-200 dark:from-secondary dark:to-card dark:border-border"
        : "bg-card border-border"
    )}
  >
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
          highlight ? "bg-foreground text-background" : "bg-secondary text-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
    <Button
      variant={highlight ? "default" : "outline"}
      size="sm"
      className="mt-4 w-full"
      asChild
    >
      <Link to={to}>{cta} <ArrowUpRight className="h-3.5 w-3.5" /></Link>
    </Button>
  </div>
);

export default NextActionCard;
