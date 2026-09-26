import { BookOpen, TrendingUp, Star, BarChart2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const benefits = [
  {
    icon: BookOpen,
    title: "Tell your story",
    description: "Share your company's mission, vision, and culture through rich media content that resonates with candidates.",
  },
  {
    icon: TrendingUp,
    title: "Influence talent",
    description: "Shape how top candidates perceive your organization and stand out in a competitive hiring market.",
  },
  {
    icon: Star,
    title: "Beyond reviews",
    description: "Go beyond ratings with detailed insights into what makes your workplace special and unique.",
  },
  {
    icon: BarChart2,
    title: "Rich analytics",
    description: "Track engagement, measure brand awareness, and understand what content drives candidate interest.",
  },
];

const Benefits = () => {
  return (
    <section className="py-32">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-foreground mb-4">
            Build a brand that attracts
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to create a compelling employer brand.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex gap-5">
              <div className="flex-shrink-0 w-12 h-12 bg-background rounded-xl flex items-center justify-center">
                <benefit.icon className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            </div>
          ))}
        </div>
         {/* CTA */}
        <div className="text-center mt-12">
          <Button size="lg" className="group rounded-full" asChild>
            <Link to="/employers/company">
              Build Your Employer Brand
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Benefits;
