import { BadgeCheck, Sparkles, Clock, Globe } from "lucide-react";

const benefits = [
  {
    icon: BadgeCheck,
    title: "Quality over quantity",
    description: "Reach candidates with complete, verified profiles — not a pile of unqualified applications to wade through.",
  },
  {
    icon: Sparkles,
    title: "Smart matching",
    description: "Relevance ranking puts the best-fit candidates first, cutting the time you spend screening.",
  },
  {
    icon: Clock,
    title: "Faster time-to-hire",
    description: "Connect with people who are ready to talk, so roles get filled in less time.",
  },
  {
    icon: Globe,
    title: "Reach further",
    description: "Tap a remote-ready, diverse talent pool beyond your immediate network.",
  },
];

const WhyInvest = () => {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-4 md:px-12 lg:px-24">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Why it's worth <span className="text-coral">your investment</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Spend your hiring budget where it counts — on reaching the right people, faster.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="group flex gap-4 p-6 rounded-xl border border-border bg-card hover:shadow-md transition-all duration-300"
            >
              <div className="h-12 w-12 rounded-xl bg-coral/10 text-coral flex items-center justify-center shrink-0">
                <b.icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1.5">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyInvest;
