import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";
import candidateSearchImage from "@/assets/candidate-search.jpg";
import { Link } from "react-router-dom";

const SearchTeaser = () => {

  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4 md:px-12 lg:px-24">
        <div className="grid gap-8 lg:grid-cols-2 items-center">
         <div className="order-2 lg:order-1">
            <img
              src={candidateSearchImage}
              alt="Candidate search interface"
              className="rounded-2xl border border-border w-full object-cover"
            />
          </div>
          <div className="order-1 lg:order-2 space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Connect with the right talent faster
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              Go beyond job ads proactively search and connect with candidates who match
              your exact requirements. Our AI-powered search finds passive candidates ready
              for their next opportunity.
            </p>

              <ul className="space-y-3 mb-6">
  <li className="flex items-center gap-3">
    <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
      <Check className="w-3 h-3 text-white" />
    </div>
    Search millions of verified profiles
  </li>

    <li className="flex items-center gap-3">
    <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
      <Check className="w-3 h-3 text-white" />
    </div>
    AI-powered skill matching
  </li>

    <li className="flex items-center gap-3">
    <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
      <Check className="w-3 h-3 text-white" />
    </div>
    Direct messaging to top candidates
  </li>

  <li className="flex items-center gap-3">
    <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
      <Check className="w-3 h-3 text-white" />
    </div>
    Save searches for instant alerts
  </li>
            </ul>
            <Link to="/find-talent">
            <Button size="sm" className="gap-2 mt-2 rounded-full">
              Try Candidate Search now
              <ArrowRight className="h-3 w-3" />
            </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SearchTeaser;
