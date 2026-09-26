import { Check, CheckCircle2} from 'lucide-react';
import { Button } from '@/components/ui/button';

const plans = [
  {
    name: 'Starter',
    price: '$0',
    period: '/month',
    description: 'Perfect for small teams getting started.',
    features: ['Basic company profile', 'Up to 5 job listings', 'Culture page', 'Basic analytics'],
    cta: 'Get Started Free',
    featured: false,
  },
  {
    name: 'Growth',
    price: '$99',
    period: '/month',
    description: 'For growing companies scaling their brand.',
    features: ['Enhanced profile', 'Unlimited job listings', 'Employee testimonials', 'Media galleries', 'Advanced analytics', 'Priority support'],
    cta: 'Start Free Trial',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations with complex needs.',
    features: ['Everything in Growth', 'Custom branding', 'API access', 'Dedicated account manager', 'SSO & security', 'Custom integrations'],
    cta: 'Contact Sales',
    featured: false,
  },
];

const PricingSection = () => {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-4 md:px-12 lg:px-24">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Simple, transparent <span className="gradient-text-hero">pricing</span>
          </h2>
          <p className="text-lg text-muted-foreground">Start free. Scale as you grow.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-8 flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                plan.featured
                  ? 'border-orange-500 shadow-2xl scale-105 z-10 bg-orange-50'
                  : 'border-border hover:shadow-lg'
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white 
                text-xs font-semibold px-4 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              <h3 className="text-lg font-bold text-foreground mb-1">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-coral shrink-0 mt-1"/>
                    {f}
                  </li>
                ))}
              </ul>
              <Button   size="lg" variant={plan.featured ? 'default' : 'outline'} className="w-full rounded-full">
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
