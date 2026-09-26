import { Building2, GalleryVerticalEnd, UsersRound } from 'lucide-react';

const steps = [
  { icon: Building2, step: '01', title: 'Create your company profile', description: 'Set up your employer brand page in minutes with our guided setup.' },
  { icon: GalleryVerticalEnd, step: '02', title: 'Showcase culture & benefits', description: 'Add photos, employee stories, perks, and everything that makes you unique.' },
  { icon: UsersRound, step: '03', title: 'Connect with top candidates', description: 'Attract qualified talent who align with your values and culture.' },
];

const HowItWorks = () => {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-4 md:px-12 lg:px-24">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Three steps to a <span className="gradient-text-hero">stronger brand</span>
          </h2>
          <p className="text-lg text-muted-foreground">Get started in minutes, not months.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((s, i) => (
            <div key={s.title} className="relative text-center group">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-px bg-border" />
              )}
              <div className="relative z-10 h-20 w-20 rounded-2xl bg-background border border-border shadow-sm flex items-center justify-center mx-auto mb-5 group-hover:shadow-elevated transition-shadow duration-300">
                <s.icon className="h-8 w-8 text-indigo" />
              </div>
              <span className="text-xs font-bold text-indigo/60 uppercase tracking-widest mb-2 block">{s.step}</span>
              <h3 className="font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
