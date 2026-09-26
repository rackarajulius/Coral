import { Magnet, Clock, Award, Users, UserRound, UsersRound } from 'lucide-react';

const benefits = [
  { icon: Magnet, title: 'Attract better candidates', description: 'Candidates self-select based on culture fit, leading to higher-quality applicants.' },
  { icon: Clock, title: 'Reduce hiring time', description: 'Informed candidates move faster through your pipeline.' },
  { icon: Award, title: 'Improve employer reputation', description: 'A strong brand makes you an employer of choice in your industry.' },
  { icon: UsersRound, title: 'Build long-term talent pipeline', description: 'Even passive candidates follow your brand for future opportunities.' },
];

const TalentAttraction = () => {
  return (
    <section className="py-20 lg:py-28 bg-background relative overflow-hidden">
      <div className="absolute bottom-0 right-0 w-96 h-96 blob-rose opacity-5" />

      <div className="container mx-auto px-4 md:px-12 lg:px-24">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Turn your company into a <span className="gradient-text-hero">talent magnet</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Companies with strong employer brands see 50% more qualified applicants and 28% lower turnover.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {benefits.map((b) => (
            <div key={b.title} className="flex gap-4 p-6 rounded-xl border border-border 
            bg-card hover:shadow-md transition-all duration-300">
              <div className="h-11 w-11 rounded-full bg-orange/10 flex items-center justify-center shrink-0">
                <b.icon className="h-5 w-5 text-indigo" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TalentAttraction;
