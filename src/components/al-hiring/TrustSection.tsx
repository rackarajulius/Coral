import { CheckCircle2, Lock, Shield, Users, Eye } from "lucide-react";
import { motion } from "framer-motion";

const principles = [
  { icon: Users, title: "Human-in-the-Loop AI", description: "AI recommends, humans decide. Every shortlist is reviewed and approved by your team." },
  { icon: Eye, title: "Transparent Candidate Scoring", description: "Clear, explainable scoring breakdowns so you understand exactly why a candidate was ranked." },
  { icon: Shield, title: "Employer Control Over Matching", description: "Customize weighting for skills, experience, culture fit, and other criteria that matter to you." },
  { icon: Lock, title: "Enterprise-Grade Security", description: "SOC 2 Type II certified with end-to-end encryption and GDPR compliance built in." },
];

const TrustSection = () => (
  <section className="py-20 md:py-28">
    <div className="max-w-[1280px] mx-auto px-4 md:px-12 lg:px-24">
      <div className="rounded-2xl bg-primary/[0.03] border border-primary/10 p-8 md:p-12 lg:p-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="hidden lg:flex items-center justify-center"
          >
            <div className="relative">
              <div className="h-64 w-64 rounded-full bg-primary/5 flex items-center justify-center">
                <div className="h-44 w-44 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-16 w-16 text-primary/40" strokeWidth={1} />
                </div>
              </div>
              {[
                { label: "SOC 2", pos: "-top-2 -right-2" },
                { label: "GDPR", pos: "-bottom-2 -right-2" },
                { label: "ISO 27001", pos: "-bottom-2 -left-2" },
              ].map((badge) => (
                <div
                  key={badge.label}
                  className={`absolute ${badge.pos} bg-card border border-border rounded-lg px-3 py-1.5 shadow-md`}
                >
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">{badge.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — Principles */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5 }}
            >
              <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">Trust & Transparency</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">
                AI you can trust with your hiring
              </h2>
              <p className="text-muted-foreground mb-8 max-w-md">
                We believe AI should augment human judgment, not replace it. Here's how we ensure responsible AI hiring.
              </p>
            </motion.div>

            <div className="space-y-4">
              {principles.map((p, i) => (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="flex gap-4"
                >
                  <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                    <p.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">{p.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default TrustSection;
