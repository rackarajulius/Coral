import {BarChart3, Building2, Check, CheckCircle, CheckCircle2, ChevronRight, Crown, Sparkles, Users, UsersRound, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';


const features = [
  {
    id: 'applicant-tracking',
    title: 'Applicant Tracking System',
    description: 'Streamline your hiring pipeline with our intuitive Kanban-style applicant tracking.',
    icon: UsersRound,
    badge: 'Popular',
    features: [
      'Kanban-style pipeline view',
      'Drag-and-drop candidate management',
      'Automated status updates',
      'Candidate notes and tags',
    ],
    stats: { label: 'Time saved', value: '60%' }
  },
  {
    id: 'ai-matching',
    title: 'AI Candidate Matching',
    description: 'Let AI find the best candidates for your roles based on skills, experience, and fit.',
    icon: Sparkles,
    badge: 'AI Powered',
    features: [
      'Smart resume parsing',
      'Skill & experience matching',
      'Candidate relevance scoring',
      'Bias-reduced shortlisting',
    ],
    stats: { label: 'Accuracy rate', value: '95%' }
  },
  {
    id: 'employer-branding',
    title: 'Employer Branding Pages',
    description: 'Showcase your company culture and attract top talent with custom branding pages.',
    icon: Building2,
    badge: 'Premium',
    features: [
      'Custom company profile',
      'Culture & values showcase',
      'Employee testimonials',
      'Office photos & videos',
    ],
    stats: { label: 'More applicants', value: '3x' }
  },
  {
    id: 'featured-listings',
    title: 'Featured Job Listings',
    description: 'Boost your job visibility and reach more qualified candidates with premium placement.',
    icon: Crown,
    badge: 'Sponsored',
    features: [
      'Premium job placement',
      'Priority in search results',
      'Featured on homepage',
      'Social media promotion',
    ],
    stats: { label: 'More views', value: '5x' }
  },
  {
    id: 'analytics',
    title: 'Advanced Analytics',
    description: 'Make data-driven hiring decisions with comprehensive analytics and insights.',
    icon: BarChart3,
    badge: 'Insights',
    features: [
      'Real-time dashboards',
      'Application funnel analysis',
      'Source tracking',
      'Time-to-hire metrics',
    ],
    stats: { label: 'Better decisions', value: '40%' }
  },
  {
    id: 'ai-assistant',
    title: 'AI Hiring Assistant',
    description: 'Get AI-powered help with job descriptions, screening questions, and outreach.',
    icon: Zap,
    badge: 'New',
    features: [
      'Job description generator',
      'Screening question suggestions',
      'Outreach message drafts',
      'Interview question bank',
    ],
    stats: { label: 'Time saved', value: '75%' }
  }
];

const FeaturesGrid = () => {
  return (
    <section className="py-20">
         <div className="container mx-auto px-4 md:px-12 lg:px-24">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Powerful <span className="gradient-text">Features</span>
            </h2>
            <p className="text-muted-foreground text-lg">Explore our complete toolkit for modern recruitment</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.id} className="group card-interactive border border-border overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center`}>
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="default" className="text-xs">{feature.badge}</Badge>
                      <div className="text-right">
                        <p className="text-xl font-bold text-foreground">{feature.stats.value}</p>
                        <p className="text-xs text-muted-foreground">{feature.stats.label}</p>
                      </div>
                    </div>
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-5">
                    {feature.features.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary rounded-full  shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Button variant="default"  size="lg" className="w-full text-center group/btn rounded-full">
                    Learn More
                    <ChevronRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      
    </section>
  )
}

export default FeaturesGrid
