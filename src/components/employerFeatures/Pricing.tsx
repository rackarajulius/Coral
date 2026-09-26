import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, CheckCircle2 } from 'lucide-react';


const pricingTiers = [
  { name: 'Starter', price: 'Free', description: 'Perfect for small teams getting started', features: ['3 active job postings', 'Basic applicant tracking', 'Email support', 'Standard analytics'], cta: 'Get Started', popular: false },
  { name: 'Pro', price: '$99', period: '/month', description: 'For growing teams with advanced needs', features: ['Unlimited job postings', 'AI candidate matching', 'Employer branding page', 'Advanced analytics', 'Priority support', 'Team collaboration'], cta: 'Start Free Trial', popular: true },
  { name: 'Enterprise', price: 'Custom', description: 'For large organizations with custom needs', features: ['Everything in Pro', 'Custom integrations', 'Dedicated account manager', 'SLA guarantee', 'Custom training', 'API access'], cta: 'Contact Sales', popular: false },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-20 px-6 surface-light">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Simple, Transparent <span className="gradient-text">Pricing</span>
            </h2>
            <p className="text-muted-foreground text-lg">Choose the plan that fits your hiring needs</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricingTiers.map((tier) => (
              <Card
                key={tier.name}
                  className={`relative rounded-2xl flex flex-col h-full transition-all duration-300 hover:-translate-y-1 ${ tier.popular
                 ? 'border-orange-500 shadow-2xl scale-105 z-10 bg-orange-50'
                 : 'border-border hover:shadow-sm'
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div className="bg-orange-500 text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold shadow-md">Most Popular</div>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{tier.name}</CardTitle>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-4xl font-extrabold text-foreground">{tier.price}</span>
                    {tier.period && <span className="text-muted-foreground">{tier.period}</span>}
                  </div>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6 flex-1">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button  size="lg" variant={tier.popular ? 'default' : 'outline'} className="w-full rounded-full">
                    {tier.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      
    </section>
  )
}

export default Pricing
