import { Quote } from "lucide-react";

/**
 * PLACEHOLDER social proof — layout only. The logos and quotes below are
 * generic and NOT attributed to real people or companies. Replace with real
 * customer logos/testimonials before treating this as marketing truth.
 * TODO: swap placeholder logos + testimonials for real ones.
 */
const testimonials = [
  {
    quote: "The matched shortlist saved our team hours of screening every week — we talked to fewer, better-fit candidates.",
    role: "Head of Talent",
    company: "Company name",
  },
  {
    quote: "We filled two hard-to-hire roles in a fraction of the usual time. The ranking actually reflected fit.",
    role: "Engineering Manager",
    company: "Company name",
  },
  {
    quote: "Posting a role and getting relevant candidates back was refreshingly simple.",
    role: "Founder",
    company: "Company name",
  },
];

const SocialProof = () => {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-4 md:px-12 lg:px-24">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Built for teams that <span className="text-coral">hire well</span>
          </h2>
          <p className="text-lg text-muted-foreground">Trusted by growing teams to find their next hire.</p>
        </div>

        {/* Placeholder logo strip */}
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mb-14">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 w-32 rounded-lg bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground/70"
            >
              Your logo
            </div>
          ))}
        </div>

        {/* Placeholder testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <div key={i} className="relative p-6 rounded-2xl border border-border bg-card">
              <Quote className="h-7 w-7 text-coral/30 mb-3" />
              <p className="text-sm text-foreground leading-relaxed mb-5">{t.quote}</p>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{t.role}</p>
                  <p className="text-xs text-muted-foreground">{t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SocialProof;
