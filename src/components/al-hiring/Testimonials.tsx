import { Star } from "lucide-react";
import { motion } from "framer-motion";

const testimonials = [
  {
    quote: "HireAI cut our time-to-hire by 60% and the quality of candidates we're seeing has dramatically improved. It's become indispensable to our recruiting team.",
    name: "Sarah Mitchell",
    role: "VP of People",
    company: "Stratum Technologies",
    initials: "SM",
  },
  {
    quote: "We went from drowning in 500+ applications per role to reviewing a focused shortlist of 15 perfectly matched candidates. The AI scoring is remarkably accurate.",
    name: "David Park",
    role: "Head of Talent Acquisition",
    company: "Nexus Financial",
    initials: "DP",
  },
  {
    quote: "The bias-reduction features alone justified the investment. We've seen a 35% increase in diverse hires since implementing HireAI across our organization.",
    name: "Rachel Torres",
    role: "Chief People Officer",
    company: "Meridian Health",
    initials: "RT",
  },
];

const Testimonials = () => (
  <section id="testimonials" className="py-20 md:py-28">
    <div className="max-w-[1280px] mx-auto px-4 md:px-12 lg:px-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.5 }}
        className="text-center mb-14"
      >
        <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">Testimonials</p>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">
          Trusted by enterprise recruiting teams
        </h2>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-6">
        {testimonials.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="rounded-xl border border-border bg-card p-7 flex flex-col"
          >
            <div className="flex gap-0.5 mb-4">
              {Array.from({ length: 5 }).map((_, j) => (
                <Star key={j} className="h-4 w-4 fill-amber text-amber" />
              ))}
            </div>
            <blockquote className="text-sm text-foreground leading-relaxed mb-6 flex-1">
              "{t.quote}"
            </blockquote>
            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{t.initials}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}, {t.company}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default Testimonials;
