import { FileText, Sparkles, Handshake } from "lucide-react";

const steps = [
  {
    icon: FileText,
    step: "01",
    title: "Post your role",
    description: "Tell us what you're hiring for in minutes — title, must-have skills, and location.",
  },
  {
    icon: Sparkles,
    step: "02",
    title: "Get matched candidates",
    description: "Candidates are surfaced and ranked by how well they fit the role, so the strongest options rise to the top.",
  },
  {
    icon: Handshake,
    step: "03",
    title: "Connect & hire",
    description: "Message, interview, and make an offer to the people who fit — all in one place.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-4 md:px-12 lg:px-24">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Hiring in <span className="text-coral">three steps</span>
          </h2>
          <p className="text-lg text-muted-foreground">From open role to signed offer — without the busywork.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((s, i) => (
            <div key={s.title} className="relative text-center group">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-px bg-border" />
              )}
              <div className="relative z-10 h-20 w-20 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-center mx-auto mb-5 group-hover:shadow-md transition-shadow duration-300">
                <s.icon className="h-8 w-8 text-coral" />
              </div>
              <span className="text-xs font-bold text-coral/70 uppercase tracking-widest mb-2 block">{s.step}</span>
              <h3 className="font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
