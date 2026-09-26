import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Quote } from "lucide-react";

const testimonials = [
  {
    quote: "CareerConnect transformed how we attract talent. Our employer brand visibility increased by 300% in just 6 months.",
    author: "Sarah Chen",
    title: "VP of People",
    company: "Stripe",
    logo: "stripe",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face",
  },
  {
    quote: "The AI-powered matching is incredible. We've cut our time-to-hire by 40% while improving candidate quality significantly.",
    author: "Marcus Williams",
    title: "Chief HR Officer",
    company: "Shopify",
    logo: "shopify",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
  },
  {
    quote: "Finally, a platform that understands employer branding isn't just about job posts. It's about telling your company's story.",
    author: "Emily Rodriguez",
    title: "Head of Talent Acquisition",
    company: "Notion",
    logo: "notion",
    avatar: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=100&h=100&fit=crop&crop=face",
  },
  {
    quote: "Our candidate pipeline tripled after showcasing our culture on CareerConnect. The analytics alone are worth the investment.",
    author: "David Park",
    title: "Director of Recruiting",
    company: "Figma",
    logo: "figma",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face",
  },
  {
    quote: "We went from struggling to find qualified candidates to having a waitlist of top talent wanting to join us.",
    author: "Jennifer Liu",
    title: "VP of Human Resources",
    company: "Vercel",
    logo: "vercel",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
  },
];

const CompanyLogo = ({ company }: { company: string }) => {
  return (
    <div className="text-lg font-bold tracking-tight text-foreground/80">
      {company}
    </div>
  );
};

const Testimonials = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true,
    align: "center",
  });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollTo = useCallback(
    (index: number) => emblaApi && emblaApi.scrollTo(index),
    [emblaApi]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    
    // Auto-play
    const autoplay = setInterval(() => {
      if (emblaApi.canScrollNext()) {
        emblaApi.scrollNext();
      } else {
        emblaApi.scrollTo(0);
      }
    }, 5000);

    return () => {
      emblaApi.off("select", onSelect);
      clearInterval(autoplay);
    };
  }, [emblaApi, onSelect]);

  return (
    <section className="py-24 overflow-hidden">
      <div className="container mx-auto px-4 md:px-12 lg:px-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground tracking-tight">
            Trusted by industry leaders
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            See why thousands of companies trust CareerConnect to build their employer brand.
          </p>
        </div>

        {/* Company Logos Bar */}
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 mb-16 opacity-60">
          {testimonials.map((t) => (
            <CompanyLogo key={t.company} company={t.company} />
          ))}
        </div>

        {/* Carousel */}
       {/* Carousel */}
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="flex-[0_0_100%] min-w-0 md:flex-[0_0_80%] lg:flex-[0_0_60%] px-4"
              >
                <div className="bg-card rounded-xl p-8 border border-border md:p-12 relative">
                    
                  <Quote className="absolute top-8 left-8 h-10 w-10 text-primary/10" />
                  <blockquote className="relative z-10">
                    <p className="text-xl md:text-2xl text-foreground leading-relaxed font-medium">
                      "{testimonial.quote}"
                    </p>
                    <footer className="mt-8 flex items-center gap-4">
                      <img 
                        src={testimonial.avatar} 
                        alt={testimonial.author}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div>
                        <cite className="not-italic font-semibold text-foreground block">
                          {testimonial.author}
                        </cite>
                        <span className="text-sm text-muted-foreground">
                          {testimonial.title}, {testimonial.company}
                        </span>
                      </div>
                    </footer>
                  </blockquote>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Dots */}
        <div className="flex items-center justify-center gap-2 mt-8">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                index === selectedIndex
                  ? "bg-primary w-8"
                  : "bg-primary/20 hover:bg-primary/40"
              }`}
              aria-label={`Go to testimonial ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
