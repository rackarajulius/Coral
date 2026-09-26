import { useEffect, useRef, useState } from "react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  BadgeCheck,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Globe,
  Heart,
  Leaf,
  MapPin,
  Play,
  Plus,
  Quote,
  Rocket,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import Navbar from "@/components/navbar/Navbar";
import Footer from "@/components/landing/Footer";

// -------- Mock Data ----------
const company = {
  name: "Lumen Labs",
  tagline: "Building the operating system for human creativity.",
  verified: true,
  rating: 4.8,
  reviewCount: 1284,
  cover:
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=2000&q=80",
  logo: "https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&h=200&fit=crop",
  industry: "Software · AI",
  location: "San Francisco, CA",
  size: "501–1,000",
  founded: 2018,
  openRoles: 23,
  followers: "48.2k",
};

const sections = [
  { id: "overview", label: "Overview" },
  { id: "jobs", label: "Jobs" },
  { id: "culture", label: "Culture" },
  { id: "reviews", label: "Reviews" },
  { id: "salaries", label: "Salaries" },
];

const whyWorkHere = [
  { icon: Rocket, title: "Ship at velocity", desc: "Small teams, big ownership. Ideas reach users in days, not quarters." },
  { icon: Heart, title: "People-first", desc: "Generous leave, mental health support, and a culture that respects your time." },
  { icon: Globe, title: "Remote-friendly", desc: "Work from 32 countries with quarterly team gatherings in stunning locations." },
  { icon: Sparkles, title: "Learn relentlessly", desc: "$3,000/yr learning stipend, conference budget, and dedicated focus Fridays." },
  { icon: Shield, title: "Top-tier benefits", desc: "Premium healthcare, equity for everyone, and a fully covered home office setup." },
  { icon: Leaf, title: "Sustainable growth", desc: "Profitable, founder-led, and building for the next decade — not the next quarter." },
];

const media = [
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80",
  "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80",
  "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&q=80",
  "https://images.unsplash.com/photo-1560439514-4e9645039924?w=1200&q=80",
  "https://images.unsplash.com/photo-1531497865144-0464ef8fb9a9?w=1200&q=80",
  "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1200&q=80",
];

const awards = [
  { title: "Best Places to Work", org: "Fortune", year: 2025 },
  { title: "AI Company of the Year", org: "TechCrunch", year: 2024 },
  { title: "Top 50 Startups", org: "Forbes", year: 2024 },
  { title: "Most Innovative", org: "Fast Company", year: 2023 },
];

const certifications = [
  { icon: Trophy, label: "Great Place to Work" },
  { icon: Users, label: "DEI Certified" },
  { icon: Leaf, label: "Carbon Neutral" },
  { icon: Shield, label: "SOC 2 Type II" },
];

const diversity = [
  { label: "Women in workforce", value: 48 },
  { label: "Underrepresented minorities", value: 36 },
  { label: "Women in leadership", value: 42 },
  { label: "Pay equity", value: 99 },
];

const jobs = [
  { title: "Senior Product Designer", dept: "Design", loc: "Remote · US", type: "Full-time", salary: "$160k – $210k", posted: "2d ago", featured: true },
  { title: "Staff Software Engineer, Platform", dept: "Engineering", loc: "San Francisco", type: "Full-time", salary: "$220k – $290k", posted: "4d ago", featured: true },
  { title: "Machine Learning Researcher", dept: "Research", loc: "Remote · Global", type: "Full-time", salary: "$200k – $280k", posted: "1w ago" },
  { title: "Head of Brand", dept: "Marketing", loc: "New York", type: "Full-time", salary: "$180k – $230k", posted: "1w ago" },
  { title: "Product Manager, Growth", dept: "Product", loc: "Remote · US", type: "Full-time", salary: "$170k – $220k", posted: "2w ago" },
];

const reviews = [
  {
    rating: 5,
    quote:
      "The most empowering place I've worked. Leadership trusts you to do your best work and gets out of the way.",
    name: "Maya Patel",
    role: "Senior Engineer · 3 yrs",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
  },
  {
    rating: 5,
    quote:
      "Genuinely brilliant people, world-class craft, and a product I'm proud to build. Rare combination.",
    name: "Daniel Cho",
    role: "Design Lead · 2 yrs",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop",
  },
  {
    rating: 4,
    quote:
      "Fast pace, high standards. You'll grow more in a year here than three anywhere else.",
    name: "Priya Shah",
    role: "Product Manager · 1.5 yrs",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop",
  },
];

const ratingBreakdown = [
  { label: "Culture", value: 4.9 },
  { label: "Compensation", value: 4.7 },
  { label: "Leadership", value: 4.8 },
  { label: "Growth", value: 4.6 },
];

const salaries = [
  { role: "Software Engineer", min: 160, max: 240, median: 195, trend: "up" },
  { role: "Product Designer", min: 150, max: 220, median: 185, trend: "up" },
  { role: "Product Manager", min: 170, max: 250, median: 210, trend: "up" },
  { role: "Data Scientist", min: 155, max: 235, median: 190, trend: "down" },
];

const otherCompanies = [
  { name: "Northwind", industry: "Fintech", desc: "Modern banking infrastructure for builders.", jobs: 14, cover: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&q=80" },
  { name: "Helia", industry: "Climate", desc: "Software accelerating the energy transition.", jobs: 9, cover: "https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=600&q=80" },
  { name: "Quill AI", industry: "AI · Productivity", desc: "Tools for the next generation of writers.", jobs: 21, cover: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80" },
  { name: "Mosaic", industry: "Healthcare", desc: "Patient data, finally unified and useful.", jobs: 7, cover: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&q=80" },
];

// -------- Page ----------
const EmployerProfile = () => {
  // Shared with every other page, so the tab reads the same way and is put
  // back on the way out. This page is still hard-coded demo data.
  useDocumentTitle(`${company.name} careers`);

  const [activeTab, setActiveTab] = useState("overview");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [stickyDismissed, setStickyDismissed] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const otherRef = useRef<HTMLDivElement>(null);

  // Scroll spy
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveTab(e.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  // Lightbox keyboard nav
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => (i === null ? 0 : (i + 1) % media.length));
      if (e.key === "ArrowLeft") setLightbox((i) => (i === null ? 0 : (i - 1 + media.length) % media.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const scrollBy = (ref: React.RefObject<HTMLDivElement>, dir: 1 | -1) => {
    ref.current?.scrollBy({ left: dir * 400, behavior: "smooth" });
  };

  // SEO + JSON-LD
  useEffect(() => {
    const desc = `${company.name}: ${company.tagline} ${company.openRoles} open roles. Rated ${company.rating}★ by employees.`;
    let m = document.querySelector('meta[name="description"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
    }
    m.setAttribute("content", desc);

    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: company.name,
      description: company.tagline,
      foundingDate: String(company.founded),
      address: { "@type": "PostalAddress", addressLocality: company.location },
    });
    document.head.appendChild(ld);
    return () => {
      document.head.removeChild(ld);
    };
  }, []);

  return (
    <div className="min-h-screen bg-secondary">
      <Navbar />

      {/* HERO */}
      <section className="relative max-w-4xl mx-auto pt-20">
      <div className="relative h-[150px] md:h-[250px] w-full overflow-hidden rounded-xl border border-slate-200 border-b-0 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
          <img src={company.cover} alt={`${company.name} cover`} className="h-full w-full object-cover" loading="eager" />
          <div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/40 to-transparent" />
        </div>

        <div className="container mx-auto px-6">
          <div className="relative -mt-20 md:-mt-24 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-end animate-fade-in">
            <div className="flex flex-col md:flex-row gap-6 md:items-end">
              <div className="h-14 w-14 rounded-2xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden shrink-0">
                <img src={company.logo} alt={`${company.name} logo`} className="h-full w-full object-cover" />
              </div>
              <div className="pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-white">{company.name}</h1>
                  {company.verified && <BadgeCheck className="h-5 w-5 text-orange-500"/>}
                  <Badge variant="secondary" className="ml-2 bg-orange-500/10 text-orange-600 border border-orange-500/20">
                    <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" /> Actively hiring
                  </Badge>
                </div>
                <p className="mt-2 text-xs md:text-base text-muted-foreground max-w-2xl">{company.tagline}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5"><Building2 className="h-4 w-4" />{company.industry}</span>
                  <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{company.location}</span>
                  <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{company.size}</span>
                  <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" />Founded {company.founded}</span>
                  <span className="inline-flex items-center gap-1.5"><Star className="h-4 w-4 fill-amber-500 text-amber-500" />{company.rating} · {company.reviewCount.toLocaleString()} reviews</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch lg:min-w-[240px]">
              <Button size="sm" className="rounded-full" onClick={() => scrollTo("jobs")}>
                <Briefcase /> View {company.openRoles} Jobs
              </Button>
              <Button size="sm" variant="outline" className="rounded-full">
                <Plus /> Follow Company
              </Button>
              <Button size="sm" variant="outline" className="rounded-full">
                <Bell /> Get Job Alerts
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* STICKY TABS */}
      <nav className="sticky  max-w-4xl mx-auto top-16 z-40 mt-10 bg-secondary/85 backdrop-blur-md">
        <div className="container mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={cn(
                  "relative px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors",
                  activeTab === s.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label}
                {activeTab === s.id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* OVERVIEW: ABOUT + WHY */}
      <section id="overview" className="py-20 md:py-24">
        <div className="container  max-w-4xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 p-8 md:p-10 rounded-2xl border-border/60">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">About {company.name}</h2>
            <p className="mt-5 text-muted-foreground leading-relaxed text-[15px]">
              We're a team of researchers, designers, and engineers building the next generation of creative software.
              Our products are used by millions of makers — from solo writers to Fortune 500 design teams — to think
              clearly, ship faster, and do their best work. We believe great tools change what people are capable of.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed text-[15px]">
              Founded in {company.founded}, profitable since 2022, and backed by Sequoia and Founders Fund. We hire
              for taste, judgment, and obsessive curiosity.
            </p>

            <div className="mt-8 flex items-center gap-4 p-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop" />
                <AvatarFallback>EM</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">Elias Moreno</p>
                <p className="text-xs text-muted-foreground">Co-founder & CEO</p>
              </div>
            </div>
          </Card>

          <div className="p-8 rounded-2xl border-border/60 bg-gradient-to-br from-primary/5 via-card to-card">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-lg font-semibold">Our Mission</h3>
            <p className="mt-3 text-muted-foreground leading-relaxed text-[15px]">
              To build software that makes the next billion creators possible — tools that respect attention,
              amplify intent, and turn good ideas into great work.
            </p>
          </div>
        </div>

        {/* WHY WORK HERE */}
        <div className="container  max-w-4xl mx-auto px-6 mt-20">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Why work here</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">A place built for your best decade.</h2>
          </div>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {whyWorkHere.map((w, i) => (
              <Card key={i} className="group p-7 rounded-2xl border-border/60 transition-all hover:-translate-y-1 hover:shadow-card-hover">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <w.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-base font-semibold">{w.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{w.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CULTURE */}
      <section id="culture" className="py-20 md:py-24 bg-card border-y border-border/60">
        <div className="container  max-w-4xl mx-auto px-6">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Life at {company.name}</p>
              <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Inside the studio.</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="rounded-full" onClick={() => scrollBy(carouselRef, -1)} aria-label="Previous">
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="icon" className="rounded-full" onClick={() => scrollBy(carouselRef, 1)} aria-label="Next">
                <ChevronRight />
              </Button>
            </div>
          </div>

          <div ref={carouselRef} className="mt-8 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 no-scrollbar">
            {media.map((src, i) => (
              <button
                key={i}
                onClick={() => setLightbox(i)}
                className="relative shrink-0 snap-start group overflow-hidden rounded-2xl w-[80vw] sm:w-[420px] aspect-[4/3]"
              >
                <img src={src} alt={`Life at ${company.name} ${i + 1}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                {i === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="h-6 w-6 text-primary fill-primary ml-1" />
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Awards & Certs */}
          <div className="mt-16  max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-7 rounded-2xl lg:col-span-2 border-border/60">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                <h3 className="text-lg font-semibold">Awards & Recognition</h3>
              </div>
              <ul className="mt-5 divide-y divide-border/60">
                {awards.map((a, i) => (
                  <li key={i} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.org}</p>
                    </div>
                    <Badge variant="secondary" className="rounded-full">{a.year}</Badge>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-7 rounded-2xl border-border/60">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Certifications</h3>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {certifications.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-secondary border border-border px-3 py-1.5 text-xs font-medium">
                    <c.icon className="h-3.5 w-3.5" /> {c.label}
                  </span>
                ))}
              </div>
            </Card>
          </div>

          {/* Diversity */}
          <Card className="mt-6 p-8 rounded-2xl border-border/60">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Diversity & Inclusion</h3>
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
              {diversity.map((d, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{d.label}</span>
                    <span className="text-muted-foreground tabular-nums">{d.value}%</span>
                  </div>
                  <Progress value={d.value} className="mt-2 h-2" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* JOBS */}
      <section id="jobs" className="py-20 md:py-24">
        <div className="container  max-w-4xl mx-auto px-6">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <Badge variant="secondary" className="rounded-full mb-3">{company.openRoles} open roles</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Find your next role.</h2>
              <p className="mt-2 text-muted-foreground">Hand-picked roles where your work will matter from day one.</p>
            </div>
            <Button variant="outline" className="rounded-full">View all jobs</Button>
          </div>

          <div className="mt-10 space-y-3">
            {jobs.map((j, i) => (
              <Card key={i} className="group p-6 rounded-2xl border-border/60 transition-all hover:shadow-card-hover hover:border-primary/30 cursor-pointer">
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold truncate group-hover:text-primary transition-colors">{j.title}</h3>
                      {j.featured && (
                        <Badge className="rounded-full bg-amber-500/15 text-amber-700 border border-amber-500/20 hover:bg-amber-500/20">
                          <Zap className="h-3 w-3 mr-1" /> Featured
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>{j.dept}</span>
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{j.loc}</span>
                      <span>{j.type}</span>
                      <span className="font-medium text-foreground">{j.salary}</span>
                      <span>· {j.posted}</span>
                    </div>
                  </div>
                  <Button className="rounded-full shrink-0">View Job <ChevronRight /></Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section id="reviews" className="py-20 md:py-24 bg-card border-y border-border/60">
        <div className="container  max-w-4xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-10">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Employee reviews</p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-5xl font-bold tracking-tight">{company.rating}</span>
              <span className="text-muted-foreground">/ 5</span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400" />
              ))}
              <span className="ml-2 text-sm text-muted-foreground">{company.reviewCount.toLocaleString()} reviews</span>
            </div>
            <div className="mt-6 space-y-3">
              {ratingBreakdown.map((r) => (
                <div key={r.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{r.label}</span>
                    <span className="font-medium tabular-nums">{r.value}</span>
                  </div>
                  <Progress value={(r.value / 5) * 100} className="mt-1.5 h-1.5" />
                </div>
              ))}
            </div>
            <Button variant="outline" className="mt-7 rounded-full">View all reviews</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {reviews.map((r, i) => (
              <Card key={i} className="p-7 rounded-2xl border-border/60 flex flex-col">
                <Quote className="h-6 w-6 text-primary/30" />
                <div className="mt-3 flex items-center gap-1 text-amber-400">
                  {Array.from({ length: r.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-amber-400" />
                  ))}
                </div>
                <p className="mt-4 text-[15px] leading-relaxed flex-1">"{r.quote}"</p>
                <div className="mt-6 flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={r.avatar} />
                    <AvatarFallback>{r.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.role}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* SALARIES */}
      <section id="salaries" className="py-20 md:py-24">
        <div className="container max-w-4xl mx-auto px-6">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Salary insights</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">What people earn here.</h2>
          <p className="mt-2 text-muted-foreground max-w-xl">Self-reported ranges from current and former employees, in USD.</p>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
            {salaries.map((s, i) => {
              const range = s.max - s.min;
              const medianPct = ((s.median - s.min) / range) * 100;
              return (
                <Card key={i} className="p-6 rounded-2xl border-border/60">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{s.role}</h3>
                    <span className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium",
                      s.trend === "up" ? "text-emerald-600" : "text-rose-600"
                    )}>
                      <TrendingUp className={cn("h-3.5 w-3.5", s.trend === "down" && "rotate-180")} />
                      {s.trend === "up" ? "Trending up" : "Trending down"}
                    </span>
                  </div>
                  <div className="mt-5 relative h-2 rounded-full bg-secondary">
                    <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-gradient-to-r from-primary/20 via-primary/60 to-primary/20" />
                    <div
                      className="absolute -top-1 h-4 w-1 rounded-full bg-primary"
                      style={{ left: `${medianPct}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>${s.min}k</span>
                    <span className="font-medium text-foreground">Median ${s.median}k</span>
                    <span>${s.max}k</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* OTHER COMPANIES */}
      <section className="pb-24">
        <div className="container  max-w-4xl mx-auto px-6">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Discover more</p>
              <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Companies you might love.</h2>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Button variant="outline" size="icon" className="rounded-full" onClick={() => scrollBy(otherRef, -1)} aria-label="Previous"><ChevronLeft /></Button>
              <Button variant="outline" size="icon" className="rounded-full" onClick={() => scrollBy(otherRef, 1)} aria-label="Next"><ChevronRight /></Button>
            </div>
          </div>

          <div ref={otherRef} className="mt-8 flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 no-scrollbar">
            {otherCompanies.map((c, i) => (
              <Card key={i} className="shrink-0 snap-start w-[300px] sm:w-[340px] rounded-2xl overflow-hidden border-border/60 transition-all hover:-translate-y-1 hover:shadow-card-hover">
                <div className="h-32 w-full overflow-hidden bg-secondary">
                  <img src={c.cover} alt={c.name} className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    <BadgeCheck className="h-4 w-4 text-primary" />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.industry}</p>
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{c.desc}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{c.jobs} open jobs</span>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="rounded-full h-8">Follow</Button>
                      <Button size="sm" className="rounded-full h-8">View</Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <Footer />

      {/* MOBILE STICKY CTA */}
      {!stickyDismissed && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border shadow-card-hover animate-fade-in">
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{company.name}</p>
              <p className="text-xs text-muted-foreground">{company.openRoles} open roles</p>
            </div>
            <Button size="sm" variant="ghost" className="rounded-full" aria-label="Get alerts">
              <Bell />
            </Button>
            <Button size="sm" className="rounded-full" onClick={() => scrollTo("jobs")}>View Jobs</Button>
            <button
              onClick={() => setStickyDismissed(true)}
              className="text-muted-foreground hover:text-foreground p-1"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightbox !== null && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-fade-in" onClick={() => setLightbox(null)}>
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            className="absolute top-5 right-5 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label="Close"
          >
            <X />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i === null ? 0 : (i - 1 + media.length) % media.length)); }}
            className="absolute left-5 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label="Previous"
          >
            <ChevronLeft />
          </button>
          <img src={media[lightbox]} alt="" className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i === null ? 0 : (i + 1) % media.length)); }}
            className="absolute right-5 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label="Next"
          >
            <ChevronRight />
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-sm">
            {lightbox + 1} / {media.length}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployerProfile;
