import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const FinalCTA = () => {
  return (
   <section className="py-24 px-6">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">
            Ready to shape your employer brand?
          </h2>
          <p className="text-muted-foreground mb-8">
            Sign up today to access your employer profile and start telling your story.
          </p>
          <Button size="xl" className="group rounded-full" asChild>
            <Link to="/employers/dashboard">
              Join CareerConnect
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </section>
  );
};

export default FinalCTA;
