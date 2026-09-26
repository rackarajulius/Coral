import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const CTA = () => {
  return (
    <section className="py-24  bg-secondary/50  relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-coral rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-coral rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 md:px-12 lg:px-24 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground mb-6">
            Ready to Take the Next Step in Your Career?
          </h2>
          <p className="text-lg text-foreground mb-10">
            Join thousands of professionals who have found their dream jobs through our platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="default" size="lg">
              Get Started Free
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="lg">
              Browse Jobs
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
