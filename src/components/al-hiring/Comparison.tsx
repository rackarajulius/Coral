import { X, Check } from "lucide-react";
import { motion } from "framer-motion";

const beforeMetrics = [
  { label: "Time screening candidates", value: "20+ hours/week" },
  { label: "Applicants reviewed", value: "23%" },
  { label: "Average hiring time", value: "30+ days" },
  { label: "Evaluation consistency", value: "Inconsistent" },
];

const afterMetrics = [
  { label: "Time saved per week", value: "15+ hours" },
  { label: "Candidates analyzed", value: "100%" },
  { label: "Faster hiring", value: "40%" },
  { label: "Evaluation method", value: "Objective scoring" },
];

const Comparison = () => (
  <section id="results" className="py-20 md:py-28 bg-background">
    <div className="max-w-[1280px] mx-auto px-4 md:px-12 lg:px-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.5 }}
        className="text-center mb-14"
      >
        <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">Before vs After</p>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">
          See the difference AI makes
        </h2>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Before */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-destructive/20 bg-card p-7"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
              <X className="h-4 w-4 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Traditional Hiring</h3>
          </div>
          <div className="space-y-4">
            {beforeMetrics.map((m) => (
              <div key={m.label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">{m.label}</span>
                <span className="text-sm font-semibold text-destructive/80">{m.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* After */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-primary/20 bg-card p-7 shadow-lg"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">With HireAI</h3>
          </div>
          <div className="space-y-4">
            {afterMetrics.map((m) => (
              <div key={m.label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">{m.label}</span>
                <span className="text-sm font-semibold text-primary">{m.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

export default Comparison;
