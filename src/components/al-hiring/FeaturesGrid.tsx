import { FileText, Target, BarChart3, Shield, Zap, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  { icon: FileText, title: "AI Resume Parsing", description: "Automatically extract skills, experience, and qualifications from any resume format with 99% accuracy." },
  { icon: Target, title: "Skill & Experience Matching", description: "Multi-dimensional fit scoring across technical skills, domain expertise, and career trajectory." },
  { icon: BarChart3, title: "Candidate Relevance Scoring", description: "Transparent scoring system that ranks candidates based on job-specific requirements and team fit." },
  { icon: Shield, title: "Bias-Reduced Shortlisting", description: "Built-in fairness algorithms ensure equitable evaluation across all demographics and backgrounds." },
  { icon: Zap, title: "Faster Time-to-Hire", description: "Reduce screening time by 73% and fill positions 40% faster with AI-powered automation." },
  { icon: TrendingUp, title: "Hiring Analytics", description: "Real-time dashboards tracking pipeline velocity, source quality, and diversity metrics." },
];

const FeaturesGrid = () => (
  <section id="features" className="py-20 md:py-28 bg-background">
    <div className="container mx-auto px-4 md:px-12 lg:px-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.5 }}
        className="text-center mb-16"
      >
        <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">Platform Capabilities</p>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">
          Everything you need to hire exceptional talent
        </h2>
        <p className="max-w-xl mx-auto text-muted-foreground">
          A complete AI-powered toolkit that replaces fragmented workflows with one intelligent platform.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="group rounded-xl border border-border bg-card p-7 hover:shadow-lg hover:border-primary/20 transition-all duration-300"
          >
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
              <f.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-semibold text-card-foreground mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesGrid;
