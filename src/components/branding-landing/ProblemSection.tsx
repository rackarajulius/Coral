import { Search, Users, TrendingDown, UsersRound } from 'lucide-react';

const painPoints = [
  { icon: Search, text: '76% of candidates research company culture before applying' },
  { icon: UsersRound, text: 'Top talent chooses companies not just jobs' },
  { icon: TrendingDown, text: 'Companies without a brand lose 50% of qualified applicants' },
];

const ProblemSection = () => {
  return (
    <section className="py-20 lg:py-28 bg-background relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 blob-rose opacity-5" />

      <div className="container mx-auto px-4 md:px-12 lg:px-24">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Top candidates choose <span className="gradient-text-hero">companies</span>, not just jobs.
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Job seekers spend hours researching company culture, values, and employee experiences before they ever click "Apply." If your employer brand is invisible, you're losing them.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {painPoints.map((point) => (
            <div
              key={point.text}
              className="flex flex-col items-center text-center p-6 rounded-xl border border-border bg-card
               hover:shadow-md transition-all duration-300"
            >
              <div className="h-12 w-12 rounded-xl bg-rose/10 flex items-center justify-center mb-4">
                <point.icon className="h-6 w-6 text-rose" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{point.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
