import { Image, MessageSquareQuote, Gift, BarChart3, Users } from 'lucide-react';

const features = [
  {  title: 'Company Culture Showcase', description: 'Share your workplace through photos, videos, and stories.' },
  {  title: 'Employee Stories', description: 'Let your team share authentic work experiences.' },
  {  title: 'Benefits & Perks Display', description: 'Highlight what makes your workplace unique.' },
  {  title: 'Media Galleries', description: 'Showcase office life, events, and team moments.' },
  {  title: 'Employer Insights', description: 'Provide transparency about your organization.' },
  {  title: 'Talent Connection', description: 'Match with candidates who align with your culture.' },
];

const SolutionSection = () => {
  return (
    <section className="py-20 lg:py-28 bg-background relative overflow-hidden">
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] blob-indigo opacity-5" />
      <div className="container mx-auto px-4 md:px-12 lg:px-24">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Showcase your company the way <span className="gradient-text-hero">top talent expects</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Everything you need to build, manage, and measure a world-class employer brand in one platform.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((f) => (
            <div
              key={f.title}
              className="group p-6 rounded-xl border border-border bg-card
              hover:shadow-md transition-all duration-300 "
            >
              <h3 className="font-semibold text-foreground mb-2 text-center">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed text-center">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
