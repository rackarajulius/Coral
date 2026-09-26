import { z } from "zod";

export const socialLinkSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "Label required").max(50),
  url: z.string().url("Valid URL required"),
});

export const locationSchema = z.object({
  id: z.string(),
  city: z.string().min(1, "City required"),
  country: z.string().min(1, "Country required"),
  isHQ: z.boolean().optional(),
});

export const valueSchema = z.object({
  id: z.string(),
  icon: z.string().optional(),
  title: z.string().min(1, "Title required").max(40),
  description: z.string().max(160).optional(),
});

export const galleryPhotoSchema = z.object({
  id: z.string(),
  url: z.string(),
  caption: z.string().max(80).optional(),
});

export const whyCardSchema = z.object({
  id: z.string(),
  icon: z.string(),
  title: z.string().min(1).max(48),
  description: z.string().max(180),
});

export const benefitSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.string(),
});

export const benefitItemSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "Label required").max(60),
  icon: z.string().optional(),
  featured: z.boolean().optional(),
  description: z.string().max(280).optional(),
  locations: z.array(z.string()).optional(),
  eligibility: z.string().max(280).optional(),
  type: z.string().optional(),
});

export const CATEGORY_ACCENTS = [
  "default",
  "coral",
  "accent",
  "emerald",
  "violet",
  "amber",
] as const;

export type CategoryAccent = (typeof CATEGORY_ACCENTS)[number];

export const benefitCategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name required").max(40),
  description: z.string().max(160).optional(),
  icon: z.string().optional(),
  accent: z.enum(CATEGORY_ACCENTS).optional(),
  expanded: z.boolean().optional(),
  items: z.array(benefitItemSchema),
});

export const BENEFIT_TYPES = [
  "Stipend",
  "Reimbursement",
  "Coverage",
  "Time off",
  "Equity",
  "Perk",
  "Program",
] as const;

export const testimonialSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name required"),
  role: z.string().min(1, "Role required"),
  avatar: z.string().optional(),
  quote: z.string().min(10).max(400),
});

export const videoTestimonialSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name required"),
  role: z.string().min(1, "Role required"),
  videoUrl: z.string().optional(),
  thumbnail: z.string().optional(),
});

export const awardSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title required").max(60),
  organization: z.string().min(1, "Organization required").max(60),
  year: z.string().min(1, "Year required"),
  description: z.string().max(160).optional(),
  badgeUrl: z.string().optional(),
});

export const deiStatSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  value: z.string().min(1),
});

export const employerBrandSchema = z.object({
  // Step 1
  banner: z.string().optional(),
  logo: z.string().optional(),
  displayName: z.string().min(2, "Company name is required").max(80),
  tagline: z.string().max(120).optional(),
  industries: z.array(z.string()).min(1, "Pick at least one industry"),
  companySize: z.string().min(1, "Required"),
  foundedYear: z.string().regex(/^\d{4}$/, "4-digit year"),
  headquarters: z.string().min(1, "Required"),
  locations: z.array(locationSchema),
  website: z.string().url("Valid URL required").or(z.literal("")),
  social: z.array(socialLinkSchema),

  // Step 2
  overview: z.string().min(40, "Add a compelling overview").max(2000),
  mission: z.string().max(400).optional(),
  vision: z.string().max(400).optional(),
  values: z.array(valueSchema),

  // Step 3
  gallery: z.array(galleryPhotoSchema),
  cultureVideo: z.string().optional(),

  // Step 4
  whyWorkHere: z.array(whyCardSchema),
  benefits: z.array(benefitSchema),
  benefitCategories: z.array(benefitCategorySchema),
  cultureDescription: z.string().max(800).optional(),
  culturePhilosophy: z.string().max(800).optional(),
  cultureCollaboration: z.string().max(800).optional(),
  cultureImage: z.string().optional(),
  awards: z.array(awardSchema).default([]),

  // Step 5
  testimonials: z.array(testimonialSchema),
  videoTestimonials: z.array(videoTestimonialSchema),
  deiStats: z.array(deiStatSchema),
  diversityStatement: z.string().max(500).optional(),

  // Step 6
  visibility: z.enum(["public", "unlisted", "private"]),
  showJobs: z.boolean(),
  allowFollow: z.boolean(),
});

export type EmployerBrand = z.infer<typeof employerBrandSchema>;

export const STEPS = [
  { id: 1, label: "Basics", description: "Identity & locations" },
  { id: 2, label: "Story", description: "About & values" },
  { id: 3, label: "Visuals", description: "Photos & video" },
  { id: 4, label: "Culture", description: "EVP & perks" },
  { id: 5, label: "People", description: "Testimonials & DEI" },
  { id: 6, label: "Review", description: "Publish" },
] as const;

export const INDUSTRIES = [
  "SaaS", "Fintech", "Healthcare", "AI / ML", "E-commerce", "Cybersecurity",
  "Developer Tools", "Marketplace", "Climate", "Education", "Gaming", "Media",
];

export const COMPANY_SIZES = [
  "1–10", "11–50", "51–200", "201–500", "501–1,000", "1,001–5,000", "5,000+",
];

export const BENEFIT_LIBRARY: { label: string; category: string }[] = [
  { label: "Unlimited PTO", category: "Time off" },
  { label: "Paid parental leave", category: "Time off" },
  { label: "Sabbatical program", category: "Time off" },
  { label: "Remote-first", category: "Flexibility" },
  { label: "Flexible hours", category: "Flexibility" },
  { label: "4-day work week", category: "Flexibility" },
  { label: "Health insurance", category: "Health" },
  { label: "Dental & vision", category: "Health" },
  { label: "Mental health stipend", category: "Health" },
  { label: "401(k) match", category: "Financial" },
  { label: "Equity / stock options", category: "Financial" },
  { label: "Learning budget", category: "Growth" },
  { label: "Conference stipend", category: "Growth" },
  { label: "Home office stipend", category: "Workspace" },
  { label: "Top-tier laptop", category: "Workspace" },
  { label: "Annual offsites", category: "Team" },
  { label: "Free lunch", category: "Perks" },
  { label: "Commuter benefits", category: "Perks" },
  { label: "Pet-friendly office", category: "Perks" },
];

export const STORAGE_KEY = "employer-brand-draft-v1";
export const PUBLISHED_KEY = "employer-brand-published-v1";
export const STEP_KEY = "employer-brand-step-v1";
export const COMPLETED_KEY = "employer-brand-completed-v1";
/** Tracks which user's account the local draft above belongs to, so a different
 *  employer signing in on the same browser doesn't inherit it. */
export const OWNER_KEY = "employer-brand-owner-v1";

/** Legacy demo URLs — treated as empty so upload placeholders show. */
const LEGACY_PLACEHOLDER_BANNER =
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&h=400&fit=crop";
const LEGACY_PLACEHOLDER_LOGO = "https://logo.clearbit.com/stripe.com";

const LEGACY_TESTIMONIAL_AVATARS = new Set([
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&h=160&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&h=160&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&h=160&fit=crop&crop=face",
]);

function normalizeMediaUrl(url?: string, legacy?: Set<string>) {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (legacy?.has(trimmed)) return undefined;
  return trimmed;
}

export function normalizeEmployerBrand(brand: EmployerBrand): EmployerBrand {
  return {
    ...brand,
    banner:
      !brand.banner?.trim() || brand.banner === LEGACY_PLACEHOLDER_BANNER
        ? undefined
        : brand.banner,
    logo: !brand.logo?.trim() || brand.logo === LEGACY_PLACEHOLDER_LOGO ? undefined : brand.logo,
    awards: brand.awards || [],
    testimonials: brand.testimonials.map((t) => ({
      ...t,
      avatar: normalizeMediaUrl(t.avatar, LEGACY_TESTIMONIAL_AVATARS),
    })),
    videoTestimonials: brand.videoTestimonials.map((v) => ({
      ...v,
      videoUrl: normalizeMediaUrl(v.videoUrl),
      thumbnail: normalizeMediaUrl(v.thumbnail),
    })),
  };
}

export const defaultEmployerBrand: EmployerBrand = {
  banner: undefined,
  logo: undefined,
  displayName: "Acme Technologies",
  tagline: "Building the operating system for modern teams.",
  industries: ["SaaS", "Developer Tools"],
  companySize: "201–500",
  foundedYear: "2019",
  headquarters: "San Francisco, CA",
  locations: [
    { id: "l1", city: "San Francisco", country: "United States", isHQ: true },
    { id: "l2", city: "London", country: "United Kingdom" },
    { id: "l3", city: "Berlin", country: "Germany" },
  ],
  website: "https://acmetech.com",
  social: [
    { id: "s1", label: "LinkedIn", url: "https://linkedin.com/company/acme" },
    { id: "s2", label: "Twitter", url: "https://twitter.com/acme" },
  ],
  overview:
    "Acme is a fast-growing platform that helps enterprises automate workflows with elegant, intelligent tooling. We're a remote-first team of 280 spread across 14 countries, building the future of work with craft and rigor.",
  mission: "Empower every team to do their best work through thoughtful automation.",
  vision: "A world where ambitious teams ship more and burn out less.",
  values: [
    { id: "v1", title: "Ship with craft", description: "We obsess over quality and ship work we're proud of." },
    { id: "v2", title: "Default to trust", description: "We assume good intent and communicate openly." },
    { id: "v3", title: "Grow together", description: "We invest in each other's growth, every quarter." },
    { id: "v4", title: "Customer obsessed", description: "Every decision starts with the customer." },
  ],
  gallery: [
    { id: "g1", url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop", caption: "Team offsite, Lisbon" },
    { id: "g2", url: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&h=600&fit=crop", caption: "SF office" },
    { id: "g3", url: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&h=600&fit=crop", caption: "Engineering huddle" },
    { id: "g4", url: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&h=600&fit=crop", caption: "Product week" },
    { id: "g5", url: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800&h=600&fit=crop", caption: "Hack day" },
    { id: "g6", url: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800&h=600&fit=crop", caption: "Founders' chat" },
  ],
  cultureVideo: "",
  whyWorkHere: [
    { id: "w1", icon: "🌍", title: "Truly remote-first", description: "Work from anywhere across 14 countries with quarterly meetups." },
    { id: "w2", icon: "📈", title: "Real growth, real fast", description: "We've doubled revenue every year for 3 years and we're just getting started." },
    { id: "w3", icon: "🧠", title: "Work with the best", description: "Engineers, designers, and operators from Stripe, Linear, Figma, and Notion." },
  ],
  benefits: [
    { id: "b1", label: "Unlimited PTO", category: "Time off" },
    { id: "b2", label: "Paid parental leave", category: "Time off" },
    { id: "b3", label: "Equity / stock options", category: "Financial" },
    { id: "b4", label: "Learning budget", category: "Growth" },
    { id: "b5", label: "Home office stipend", category: "Workspace" },
    { id: "b6", label: "Annual offsites", category: "Team" },
    { id: "b7", label: "Mental health stipend", category: "Health" },
    { id: "b8", label: "Remote-first", category: "Flexibility" },
  ],
  benefitCategories: [
    {
      id: "bc1",
      name: "Health & Wellness",
      description: "Coverage and stipends that keep you at your best.",
      icon: "HeartPulse",
      expanded: true,
      items: [
        {
          id: "bi1",
          label: "Premium health insurance",
          icon: "ShieldCheck",
          featured: true,
          description: "100% covered medical, dental, and vision for you and dependents.",
          locations: ["San Francisco", "London", "Berlin"],
          eligibility: "Full-time employees, day one.",
          type: "Coverage",
        },
        {
          id: "bi2",
          label: "Mental health stipend",
          icon: "Brain",
          featured: false,
          description: "$150/month for therapy, coaching, or meditation apps.",
          locations: ["San Francisco", "London", "Berlin"],
          eligibility: "All employees.",
          type: "Stipend",
        },
      ],
    },
    {
      id: "bc2",
      name: "Financial Benefits",
      description: "Build long-term wealth alongside the company.",
      icon: "PiggyBank",
      expanded: true,
      items: [
        {
          id: "bi3",
          label: "Equity / stock options",
          icon: "TrendingUp",
          featured: true,
          description: "Meaningful equity grants for every employee with a 10-year exercise window.",
          locations: ["San Francisco", "London", "Berlin"],
          eligibility: "All employees.",
          type: "Equity",
        },
        {
          id: "bi4",
          label: "401(k) match",
          icon: "DollarSign",
          featured: false,
          description: "We match 4% of your contributions, fully vested.",
          locations: ["San Francisco"],
          eligibility: "US full-time employees.",
          type: "Program",
        },
      ],
    },
    {
      id: "bc3",
      name: "Learning & Growth",
      description: "Invest in your craft and career.",
      icon: "GraduationCap",
      expanded: false,
      items: [
        {
          id: "bi5",
          label: "Annual learning budget",
          icon: "BookOpen",
          featured: true,
          description: "$2,000/year for books, courses, and conferences.",
          locations: ["San Francisco", "London", "Berlin"],
          eligibility: "All employees after 90 days.",
          type: "Stipend",
        },
      ],
    },
    {
      id: "bc4",
      name: "Remote Work",
      description: "Work from where you do your best thinking.",
      icon: "Home",
      expanded: false,
      items: [
        {
          id: "bi6",
          label: "Home office stipend",
          icon: "Laptop",
          featured: false,
          description: "$1,500 to set up a workspace you love, plus $100/month for internet.",
          locations: ["San Francisco", "London", "Berlin"],
          eligibility: "All employees.",
          type: "Stipend",
        },
      ],
    },
    {
      id: "bc5",
      name: "Paid Time Off",
      description: "Rest as a strategy, not an afterthought.",
      icon: "Calendar",
      expanded: false,
      items: [
        {
          id: "bi7",
          label: "Unlimited PTO (16 day min.)",
          icon: "TreePalm",
          featured: true,
          description: "Take what you need — we require a minimum of 16 days off per year.",
          locations: ["San Francisco", "London", "Berlin"],
          eligibility: "All employees.",
          type: "Time off",
        },
        {
          id: "bi8",
          label: "16 weeks parental leave",
          icon: "Baby",
          featured: false,
          description: "Fully paid for all new parents, regardless of gender.",
          locations: ["San Francisco", "London", "Berlin"],
          eligibility: "After 6 months of employment.",
          type: "Time off",
        },
      ],
    },
  ],
  cultureDescription:
    "We move fast but never alone. Decisions happen in writing, work happens in deep focus blocks, and Fridays are for shipping demos and learning together.",
  culturePhilosophy: "",
  cultureCollaboration: "",
  cultureImage: "",
  awards: [],
  testimonials: [
    {
      id: "t1",
      name: "Maya Patel",
      role: "Staff Engineer",
      quote: "It's the first place I've worked where craft and speed don't feel like a tradeoff. I ship the best work of my career here.",
    },
    {
      id: "t2",
      name: "Jordan Lee",
      role: "Product Designer",
      quote: "The bar is high, the feedback is honest, and the people genuinely care. I've grown more in a year than the previous three combined.",
    },
    {
      id: "t3",
      name: "Sam Okafor",
      role: "Engineering Manager",
      quote: "Truly remote done right — async, written, and respectful of focus time. I haven't been on a useless meeting in months.",
    },
  ],
  videoTestimonials: [
    {
      id: "vt1",
      name: "Priya Sharma",
      role: "Senior Product Manager",
      videoUrl: "",
      thumbnail: "",
    },
    {
      id: "vt2",
      name: "Alex Rivera",
      role: "Staff Engineer",
      videoUrl: "",
      thumbnail: "",
    },
  ],
  deiStats: [
    { id: "d1", label: "Women in engineering", value: "42%" },
    { id: "d2", label: "Underrepresented groups", value: "38%" },
    { id: "d3", label: "Countries represented", value: "14" },
    { id: "d4", label: "Pay equity audit", value: "Annual" },
  ],
  diversityStatement: "",
  visibility: "public",
  showJobs: true,
  allowFollow: true,
};

/** Profile strength: weighted completeness 0–100 */
export function calcProfileStrength(b: EmployerBrand): number {
  const checks: Array<[boolean, number]> = [
    [!!b.banner, 6],
    [!!b.logo, 6],
    [!!b.displayName && b.displayName.length >= 2, 4],
    [!!b.tagline, 4],
    [b.industries.length > 0, 4],
    [!!b.companySize, 3],
    [/^\d{4}$/.test(b.foundedYear || ""), 3],
    [!!b.website, 4],
    [b.social.length > 0, 4],
    [b.locations.length > 0, 4],
    [(b.overview || "").length >= 80, 8],
    [!!b.mission, 4],
    [!!b.vision, 4],
    [b.values.length >= 3, 6],
    [b.gallery.length >= 3, 8],
    [!!b.cultureVideo, 6],
    [b.whyWorkHere.length >= 2, 6],
    [b.benefitCategories.length >= 3, 4],
    [b.benefitCategories.reduce((n, c) => n + c.items.length, 0) >= 6, 4],
    [b.benefitCategories.some((c) => c.items.some((i) => !!i.featured)), 2],
    [(b.cultureDescription || "").length >= 60, 4],
    [(b.awards || []).length > 0, 3],
    [b.testimonials.length >= 2, 5],
    [b.videoTestimonials.length >= 1, 3],
    [b.deiStats.length >= 2, 4],
  ];
  const total = checks.reduce((s, [, w]) => s + w, 0);
  const got = checks.reduce((s, [ok, w]) => s + (ok ? w : 0), 0);
  return Math.round((got / total) * 100);
}