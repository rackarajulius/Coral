import { Building2, LucideIcon, Sparkles, Zap } from "lucide-react";

export type PlanId = "free" | "pro" | "enterprise";
export interface PricingPlan {
  id: PlanId;
  name: string;
  tagline: string;
  icon: LucideIcon;
  monthly: number | null; // null = custom
  yearly: number | null;
  cta: string;
  ctaVariant: "default" | "outline" | "premium";
  featured?: boolean;
  highlights: string[];
}

export const pricingPlans: PricingPlan[] = [
  {
    id: "free",
    name: "Starter",
    tagline: "For early-stage teams exploring hiring.",
    icon: Sparkles,
    monthly: 0,
    yearly: 0,
    cta: "Get Started Free",
    ctaVariant: "outline",
    highlights: [
      "Up to 3 active job posts",
      "Basic candidate inbox",
      "Standard email templates",
      "Community support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For growing teams hiring with intent.",
    icon: Zap,
    monthly: 49,
    yearly: 39,
    cta: "Start Hiring Smarter",
    ctaVariant: "premium",
    featured: true,
    highlights: [
      "Unlimited job posts",
      "AI hiring assistant & ranking",
      "Sponsored job boosts",
      "Advanced analytics & reports",
      "Branding & career page tools",
      "Team collaboration & roles",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For organizations scaling globally.",
    icon: Building2,
    monthly: null,
    yearly: null,
    cta: "Talk to Sales",
    ctaVariant: "default",
    highlights: [
      "SSO (SAML, Okta, Azure AD)",
      "Advanced permissions & audit logs",
      "API access & custom integrations",
      "Dedicated onboarding & CSM",
      "99.99% uptime SLA",
      "SOC 2 & GDPR compliance pack",
    ],
  },
];

export const roiMetrics = [
  { value: 4, suffix: "x", label: "More qualified applicants", sub: "vs. traditional job boards" },
  { value: 85, suffix: "%", label: "Faster time-to-hire", sub: "with AI screening" },
  { value: 10, suffix: "+", label: "Hours saved weekly", sub: "per recruiter" },
  { value: 40, suffix: "%", label: "Better match quality", sub: "measured at 90-day retention" },
];

export const FAQS = [
  { q: "Can I cancel anytime?", a: "Yes. You can cancel or change your plan at any time from your billing settings — no long-term contracts required." },
  { q: "Do you offer refunds?", a: "We offer a 14-day money-back guarantee on all paid plans. If it's not the right fit, reach out and we'll process a refund." },
  { q: "Is there a free trial?", a: "Every paid plan includes a 14-day free trial with full access to Pro features. No credit card required to start." },
  { q: "Can I change plans later?", a: "Absolutely. Upgrade or downgrade whenever you need — pricing is prorated automatically." },
  { q: "Do you support enterprise contracts?", a: "Yes. Our Enterprise plan includes custom contracts, invoicing, security reviews, and dedicated support. Contact sales to get started." },
  { q: "Which payment methods do you accept?", a: "We accept all major credit cards, ACH transfers, and wire transfers for Enterprise customers." },
];

export const testimonials = [
  {
    quote: "We cut our time-to-hire from 42 days to 11. The AI ranking alone replaced two screening rounds.",
    name: "Sarah Lindqvist",
    role: "Head of Talent",
    company: "Northwind Labs",
    metric: "−74% time-to-hire",
  },
  {
    quote: "The Pro plan paid for itself in the first week. Sponsored boosts tripled our qualified pipeline.",
    name: "Marcus Chen",
    role: "Founder & CEO",
    company: "Lumenly",
    metric: "3× pipeline",
  },
  {
    quote: "Rolling out SSO and SCIM across 12 regions took an afternoon. Their CSM was on call the whole way.",
    name: "Priya Ranganathan",
    role: "VP People Ops",
    company: "Atlas Federated",
    metric: "12 regions, 1 day",
  },
  {
    quote: "Our recruiters reclaimed a full day every week. That alone is worth the Enterprise contract.",
    name: "David Okafor",
    role: "Director of Recruiting",
    company: "Helix Bio",
    metric: "+20% recruiter capacity",
  },
];