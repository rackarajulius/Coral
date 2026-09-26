import { Brain, Filter, Play, RefreshCw, Search } from "lucide-react";
import { motion } from "framer-motion";
import { AspectRatio } from "@/components/ui/aspect-ratio";

const steps = [
  {
    num: "01",
    icon: Brain,
    title: "AI Job Understanding",
    description:
      "Our AI parses job descriptions to deeply understand required skills, experience levels, and cultural fit indicators.",
  },
  {
    num: "02",
    icon: Search,
    title: "Smart Candidate Matching",
    description:
      "Multi-dimensional scoring matches candidates across technical skills, soft skills, career trajectory, and growth potential.",
  },
  {
    num: "03",
    icon: Filter,
    title: "Automated Shortlisting",
    description:
      "Instantly generate ranked shortlists with transparent scoring—no black box decisions.",
  },
  {
    num: "04",
    icon: RefreshCw,
    title: "Continuous Learning",
    description:
      "The AI improves with every hiring decision, learning your preferences and refining future matches.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-16 md:py-24 lg:py-28">

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ================= HEADER ================= */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14 md:mb-16 space-y-3"
        >
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-primary">
            How It Works
          </p>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            From job post to perfect hire in four steps
          </h2>

          <p className="max-w-xl mx-auto text-sm sm:text-base text-muted-foreground leading-relaxed">
            Our AI pipeline automates the entire candidate evaluation process while keeping you in control.
          </p>
        </motion.div>

        {/* ================= GRID ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">

          {/* ================= LEFT VIDEO ================= */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="sticky top-24 hidden lg:block"
          >
            <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">

              <AspectRatio ratio={16 / 9}>
                <div className="relative w-full h-full bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5 flex items-center justify-center">

                  {/* Decorative blocks */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-30">
                    <div className="grid grid-cols-3 gap-3 w-full max-w-sm p-8">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-10 rounded-lg bg-primary/20" />
                      ))}
                    </div>
                  </div>

                  {/* Play button */}
                  <button className="relative z-10 h-14 w-14 md:h-16 md:w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl hover:scale-105 transition-transform">
                    <Play className="h-5 w-5 md:h-6 md:w-6 ml-1" />
                  </button>

                </div>
              </AspectRatio>

              <div className="p-4 md:p-5">
                <p className="font-semibold text-sm text-foreground">
                  See HireAI in Action
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Watch how AI matches candidates in under 60 seconds.
                </p>
              </div>

            </div>
          </motion.div>

          {/* ================= RIGHT STEPS ================= */}
          <div className="space-y-10 md:space-y-12">

            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="relative pl-12"
              >

                {/* Timeline line */}
                {i < steps.length - 1 && (
                  <div className="absolute left-[18px] top-10 w-px h-full bg-border" />
                )}

                {/* Icon */}
                <div className="absolute left-0 top-0 h-9 w-9 rounded-full bg-primary/10 border border-primary flex items-center justify-center">
                  <step.icon className="h-4 w-4 text-primary" />
                </div>

                {/* Content */}
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary/60">
                    Step {step.num}
                  </span>

                  <h3 className="text-base md:text-lg font-semibold text-foreground">
                    {step.title}
                  </h3>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>

              </motion.div>
            ))}

          </div>

        </div>
      </div>
    </section>
  );
};

export default HowItWorks;