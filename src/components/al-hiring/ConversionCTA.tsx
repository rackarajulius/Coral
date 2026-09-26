import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const ConversionCTA = () => (
  <section className="py-20 md:py-28">
    <div className="max-w-2xl mx-auto px-4 md:px-12 lg:px-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden p-10 md:p-16 text-center"
      >
        <div className="absolute inset-0 blob-rose opacity-20" />
        <div className="absolute inset-0 blob-amber opacity-10" style={{ top: "20%", left: "60%" }} />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 border border-primary-foreground/20 px-4 py-1.5 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
            <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Start Today</span>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary mb-4 tracking-tight">
            Let AI Find Your Best Candidates
          </h2>
          <p className="max-w-lg mx-auto text-muted-foreground mb-10 text-lg">
            Join thousands of companies hiring smarter with AI-powered candidate matching.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" variant="default" className="text-base px-8 py-6 shadow-lg rounded-full">
              Start Hiring with AI
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base px-8 py-6 rounded-full"
            >
              Request a Demo
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);

export default ConversionCTA;
