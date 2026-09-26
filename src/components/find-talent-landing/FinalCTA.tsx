import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const FinalCTA = () => {
  return (
    <section className="py-20 lg:py-28">
      <div className="container mx-auto px-4 md:px-12 lg:px-24">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-16 text-center">
          <div className="absolute inset-0 bg-coral/5 pointer-events-none" />
          <div className="relative max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-5">
              Ready to meet your <span className="text-coral">next hire?</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
              Post your first role in minutes and start connecting with candidates who fit.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="coral" size="lg" className="group rounded-full h-12 px-8 text-base" asChild>
                <Link to="/employers/jobs/post">
                  Post a job — free
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="rounded-full h-12 px-8 text-base" asChild>
                <Link to="/employers/features">Explore employer features</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
