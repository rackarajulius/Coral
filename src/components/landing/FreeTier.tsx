import { Briefcase, Building2, MessageSquare, Users, UsersRound } from "lucide-react";

const freeTierFeatures = [
  {
    icon: Briefcase,
    title: "Post a job",
    description: "Reach millions of active job seekers",
  },
  {
    icon: Building2,
    title: "Showcase brand",
    description: "Create a compelling company profile",
  },
  {
    icon: MessageSquare,
    title: "Respond to reviews",
    description: "Engage with employee feedback",
  },
  {
    icon: UsersRound,
    title: "Reach hires",
    description: "Connect directly with candidates",
  },
];

const FreeTier = () => {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4 md:px-12 lg:px-24">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 rounded-full bg-secondary text-sm font-medium text-foreground mb-4">
            Free to start
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground tracking-tight">
            Get started at no cost
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Start building your employer brand today with our free tier features.
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
          {freeTierFeatures.map((feature) => (
            <div 
              key={feature.title}
              className="flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                <feature.icon className="h-7 w-7 text-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FreeTier;
