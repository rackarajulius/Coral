import { ArrowRight, Check, Crown, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import upgradeBg from "@/assets/dashboard-upgrade.jpg";

const UpgradeBanner = () => (
  <div className="relative overflow-hidden rounded-3xl border border-border bg-card grid grid-cols-1 lg:grid-cols-2">
    <div className="p-8 lg:p-12 order-2 lg:order-1">
      <div className="flex gap-2 mb-5">
        <Badge className="bg-foreground text-background hover:bg-foreground border-0 gap-1">
          <Crown className="h-3 w-3" /> Upgrade
        </Badge>
        <Badge variant="secondary" className="border-0">Premium plans</Badge>
      </div>
      <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
        Put your roles in front of the right candidates
      </h2>
      <p className="mt-3 text-muted-foreground max-w-md">
        Sponsor jobs, unlock advanced branding, and get AI support to reduce time-to-hire.
      </p>
      <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          "Sponsored job placement",
          "Premium branding",
          "AI outreach & screening",
          "Faster hiring turnaround",
        ].map((b) => (
          <li key={b} className="flex items-center gap-2 text-sm text-foreground">
            <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Check className="h-3 w-3" />
            </span>
            {b}
          </li>
        ))}
      </ul>
      <div className="mt-7 flex flex-wrap gap-2.5">
        <Button size="sm" asChild>
          <Link to="/employers/pricing">Compare plans <ArrowRight className="h-4 w-4" /></Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to="/employers/branding">See branding tools</Link>
        </Button>
      </div>
    </div>

    <div className="relative min-h-[260px] lg:min-h-full order-1 lg:order-2 overflow-hidden">
      <img src={upgradeBg} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-l from-transparent via-card/10 to-card lg:bg-gradient-to-r lg:from-card lg:via-transparent lg:to-transparent" />
      <div className="absolute bottom-6 right-6 left-6 lg:left-auto lg:max-w-xs bg-card/90 backdrop-blur-md border border-border rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-1 text-amber-500 mb-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-3.5 w-3.5 fill-current" />
          ))}
        </div>
        <p className="text-sm font-medium text-foreground">"Filled 3 senior roles in 9 days."</p>
        <p className="text-xs text-muted-foreground mt-1">— Priya M., Head of Talent</p>
      </div>
    </div>
  </div>
);

export default UpgradeBanner;
