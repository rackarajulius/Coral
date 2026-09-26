import { AlertTriangle, Clock, Eye, UserX } from "lucide-react";
import { motion } from "framer-motion";

const painPoints = [
  {
    icon: AlertTriangle,
    title: "Too Many Irrelevant Applications",
    description: "Recruiters spend 23 hours per week reviewing unqualified candidates that never make it past screening.",
  },
  {
    icon: Clock,
    title: "Time Wasted Screening CVs",
    description: "Manual resume screening takes 6–8 seconds per resume but still misses 75% of qualified candidates.",
  },
  {
    icon: Eye,
    title: "Bias and Inconsistent Evaluations",
    description: "Unconscious bias affects 67% of hiring decisions, leading to less diverse and weaker teams.",
  },
  {
    icon: UserX,
    title: "Top Talent Being Missed",
    description: "42% of best-fit candidates are overlooked because their resumes don't match keyword filters.",
  },
];

const ProblemStatement = () => (
  <section className="py-20 md:py-28 bg-background">
    <div className="max-w-[1280px] mx-auto px-4 md:px-12 lg:px-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">
          Traditional hiring is broken
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Companies lose millions annually to slow, biased, and inefficient recruiting processes.
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        {/* Left — Pain Points */}
        <div>
          <div className="space-y-5">
            {painPoints.map((point, i) => (
              <motion.div
                key={point.title}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="flex gap-4 p-4 rounded-xl bg-card border border-border hover:border-destructive/20 transition-colors"
              >
                <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <point.icon className="h-5 w-5 text-destructive/70" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{point.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{point.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right — Illustration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="hidden lg:flex items-center justify-center"
        >
          <div className="relative w-full max-w-md">
            <div className="rounded-2xl bg-card border border-border p-8 shadow-lg">
              <div className="text-center mb-6">
                <p className="text-5xl font-extrabold text-destructive/20 mb-2">87%</p>
                <p className="text-sm text-muted-foreground">of recruiters say hiring is their #1 challenge</p>
              </div>
              <div className="space-y-3">
                {[
                   {
    label: "Time to screen",
    pct: 78,
    color: "bg-destructive/60",
  },
  {
    label: "Mis-hire rate",
    pct: 46,
    color: "bg-amber-500",
  },
  {
    label: "Candidate drop-off",
    pct: 62,
    color: "bg-destructive/40",
  },
                ].map((bar) => (
                  <div key={bar.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{bar.label}</span>
                      <span className="font-semibold text-foreground">{bar.pct}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full ${bar.color} rounded-full`}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${bar.pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

export default ProblemStatement;
