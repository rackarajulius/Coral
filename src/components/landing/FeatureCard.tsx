import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface FeatureCardProps {
  image: string;
  title: string;
  description: string;
  isSelected?: boolean;
  onClick?: () => void;
}

const FeatureCard = ({ image, title, description, isSelected, onClick }: FeatureCardProps) => {
  return (
    <div
     onClick={onClick}
     className={`group rounded-xl border border-orange bg-card p-2 transition-all  onClick={onClick} ${
    isSelected
      ? "bg-orange/5 border-border-orange"
      : "border-border"
      }`}>

      <div className="overflow-hidden rounded-lg">
        <img
          src={image}
          alt={title}
          className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="p-3 space-y-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>

        {/* CTA */}
        <div className="mt-4 text-center">
          <Button
            size="sm"
            className="group/btn rounded-full"

          >
            Learn More
            <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover/btn:translate-x-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FeatureCard;
