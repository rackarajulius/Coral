import { useEffect, useState } from "react";
import { ArrowRight, Play, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";



const Hero = () => {
  const [wordIndex, setWordIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);



  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden pt-10 md:pt-16 lg:pt-20">

      {/* ================= BACKGROUND ================= */}
      <div className="absolute inset-0 blob-indigo opacity-30" />
      <div className="absolute inset-0 blob-rose opacity-20" />
      <div className="absolute inset-0 blob-amber opacity-10" />

      {/* ================= CONTAINER ================= */}
      <div className="relative z-10 container mx-auto px-4 md:px-12 lg:px-24 py-8 md:py-12 lg:py-16">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

          {/* ================= LEFT CONTENT ================= */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left space-y-4 max-w-2xl mx-auto lg:mx-0"
          >

            {/* Heading */}
            <h1 className="text-3xl xsm:text-4xl xs:text-5xl md:text-6xl lg:text-5xl xl:text-6xl font-extrabold leading-[1.1] tracking-tight text-foreground mb-4">

              Hire Smarter with AI-Powered Matching. </h1>

            {/* Subtitle */}
            <p className="text-base text-muted-foreground leading-relaxed max-w-lg mx-auto lg:mx-0 mb-6 md:mb-8">
              Our AI analyzes skills, experience, and job requirements to surface the most relevant candidates saving you time and improving hiring quality.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">

              <Button
                size="lg"
                className="group w-full sm:w-auto h-11 md:h-12 px-6 md:px-8 text-sm md:text-base shadow-lg hover:shadow-xl transition-shadow rounded-full"
              >
                <Zap className="mr-2 h-4 w-4" />
                Post a Job with AI
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto h-11 md:h-12 px-6 md:px-8 text-sm md:text-base rounded-full"
              >
                <Play className="mr-2 h-4 w-4" />
                See How It Works
              </Button>

            </div>

          </motion.div>

          {/* ================= RIGHT VISUAL ================= */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hidden lg:block"
          >

            <div className="relative rounded-3xl border border-border bg-card/50 backdrop-blur-sm p-4 md:p-6 shadow-2xl overflow-hidden">

              {/* Header dots */}
              <div className="flex items-center gap-1.5 mb-6 border-b border-border/50 pb-4">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>

              {/* Candidate Cards */}
              {[
                { name: "Sarah Chen", role: "Senior Engineer", match: 97 },
                { name: "Marcus Johnson", role: "Full Stack Dev", match: 94 },
                { name: "Priya Patel", role: "ML Engineer", match: 91 },
              ].map((c, i) => (
                <motion.div
                  key={c.name}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.15 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 mb-3 last:mb-0"
                >

                  {/* Left */}
                  <div>
                    <p className="text-sm font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.role}</p>
                  </div>

                  {/* Right */}
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${c.match}%` }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>
                    <span className="text-sm font-bold">{c.match}%</span>
                  </div>

                </motion.div>
              ))}

            </div>

          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default Hero;