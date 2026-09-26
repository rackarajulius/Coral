import { useState } from 'react';
import { Quote, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const testimonials = [
  { quote: 'This platform transformed how we attract talent. Our quality of applicants increased by 3x within the first quarter.', name: 'Sarah Chen', role: 'Head of Talent', company: 'Fintech Startup' },
  { quote: 'We finally have a way to show candidates what it\'s really like to work here. The employee stories feature is a game-changer.', name: 'Marcus Johnson', role: 'VP People', company: 'SaaS Company' },
  { quote: 'Our time-to-hire dropped by 35% after launching our employer brand page. Candidates come in already excited about our culture.', name: 'Priya Sharma', role: 'Director of Recruiting', company: 'Enterprise Tech' },
  { quote: 'The analytics dashboard gives us insights we never had before. We can finally measure employer brand ROI.', name: 'David Park', role: 'CHRO', company: 'Growth Stage Startup' },
];

const CustomerTestimonials = () => {
  const [current, setCurrent] = useState(0);
  const t = testimonials;

  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-4 md:px-12 lg:px-24">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Loved by <span className="gradient-text-hero">hiring teams</span>
          </h2>
          <p className="text-lg text-muted-foreground">See what employers are saying.</p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="relative p-8 md:p-10 rounded-2xl border border-border bg-card">
            <Quote className="h-8 w-8 text-indigo/20 mb-4" />
            <p className="text-lg md:text-xl text-foreground leading-relaxed mb-6 min-h-[80px]">
              "{t[current].quote}"
            </p>
            <div>
              <p className="font-semibold text-foreground">{t[current].name}</p>
              <p className="text-sm text-muted-foreground">{t[current].role} · {t[current].company}</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mt-6">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => setCurrent((current - 1 + t.length) % t.length)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex gap-2">
              {t.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)} className={`h-2 rounded-full transition-all duration-300 ${i === current ? 'w-6 bg-indigo' : 'w-2 bg-border hover:bg-muted-foreground/30'}`} />
              ))}
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => setCurrent((current + 1) % t.length)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CustomerTestimonials;
