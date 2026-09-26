import { Camera, MessageCircle, Heart, BarChart3, Check } from 'lucide-react';
import featureCulture from '@/assets/feature-culture.jpg';
import featureTestimonials from '@/assets/feature-testimonials.jpg';
import featureBenefits from '@/assets/feature-benefits.jpg';
import featureInsights from '@/assets/feature-insights.jpg';

const features = [
  {
    
    title: 'Company Culture Showcase',
    description: 'Display photos, videos, and stories about your workplace. Give candidates an inside look at what it\'s really like to work at your company — from team rituals to office vibes.',
    highlights: ['Photo & video galleries', 'Culture value cards', 'Office tours'],
    image: featureCulture,
  },
  {
  
    title: 'Employee Testimonials',
    description: 'Let employees share authentic experiences in their own words. Real stories from real people build the trust that polished marketing copy never can.',
    highlights: ['Video testimonials', 'Written stories', 'Role-specific spotlights'],
    image: featureTestimonials,
  },
  {
    
    title: 'Benefits & Perks',
    description: 'Highlight what makes your workplace truly unique. From health coverage to learning stipends, make sure candidates see everything you offer.',
    highlights: ['Categorized benefits', 'Visual comparison', 'Custom perks'],
    image: featureBenefits,
  },
  {

    title: 'Employer Insights & Transparency',
    description: 'Provide transparency about your organization with data-backed insights. Show growth, diversity stats, and employee satisfaction to build trust.',
    highlights: ['Rating breakdowns', 'Growth metrics', 'Diversity data'],
    image: featureInsights,
  },
];

const ProductFeatures = () => {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-4 md:px-12 lg:px-24">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything you need to <span className="gradient-text-hero">stand out</span>
          </h2>
          <p className="text-lg text-muted-foreground">Purpose-built features for modern employer branding.</p>
        </div>

        <div className="space-y-20 max-w-5xl mx-auto">
          {features.map((f, i) => {
            const isReversed = i % 2 !== 0;
            return (
              <div
                key={f.title}
                className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center"
              >
                {/* Text */}
                <div className={`${isReversed ? 'lg:order-2' : ''}`}>
                  <h3 className="text-2xl font-bold text-foreground mb-3">{f.title}</h3>
                  <p className="text-muted-foreground leading-relaxed mb-5">{f.description}</p>
                  <ul className="space-y-2">
                    {f.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                           <Check className="w-3 h-3 text-white" />
                        </div>
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Screenshot */}
                <div className={`${isReversed ? 'lg:order-1' : ''}`}>
                  <div className="rounded-2xl border border-border bg-card overflow-hidden
                   hover:shadow-elevated transition-shadow duration-300">
                    <img
                      src={f.image}
                      alt={`${f.title} product preview`}
                      className="w-full h-auto object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ProductFeatures;
