import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export interface QuickActionCardProps {
  title: string;
  desc: string;
  cta: string;
  badge?: string;
  img: string;
  to: string;
}

const QuickActionCard = ({ title, desc, cta, badge, img, to }: QuickActionCardProps) => (
  <div className="group bg-card rounded-2xl border border-border overflow-hidden hover:shadow-md transition-all duration-300">
    <div className="relative h-32 overflow-hidden">
      <img src={img} alt="" loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
      {badge && (
        <Badge className="absolute top-2.5 right-2.5 text-[10px] rounded-full px-2 py-0.5">
          {badge}
        </Badge>
      )}
    </div>
    <div className="p-5">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{desc}</p>
      <Button size="sm" className="mt-5 w-full" asChild>
        <Link to={to}>{cta} <ArrowRight className="h-4 w-4" /></Link>
      </Button>
    </div>
  </div>
);

export default QuickActionCard;
