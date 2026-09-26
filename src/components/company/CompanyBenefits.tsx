import { 
  Heart, Brain, Dumbbell, Home, Clock, Plane, 
  DollarSign, TrendingUp, PiggyBank, GraduationCap, 
  Mic, Users, Sparkles, CheckCircle2 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { mockCompany } from '@/data/companies/profile/mockCompany';
import { EmployerCompany } from '@/lib/api/employerCompany';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  Heart, Brain, Dumbbell, Home, Clock, Plane,
  DollarSign, TrendingUp, PiggyBank, GraduationCap,
  Mic, Users,
};

interface CompanyBenefitsProps {
  company?: EmployerCompany;
}

const CompanyBenefits = ({ company }: CompanyBenefitsProps) => {
  // Real profiles store a flat list of benefit strings; the demo route's mock
  // uses a richer categorized layout. The mock is ONLY for the demo — it used
  // to fill in for any real employer who had listed no benefits, so NovaPay's
  // perks appeared under their name.
  const realBenefits = company?.companyBenefits ?? [];
  const hasReal = realBenefits.length > 0;
  if (company && !hasReal) return null;

  return (
    <Card id="benefits" className="border-border/50 rounded-3xl shadow-sm scroll-mt-28 overflow-hidden bg-white dark:bg-gray-800">
      <CardHeader className="pb-6 border-b border-border/40 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Perks & Benefits
            </CardTitle>
            <p className="text-sm text-muted-foreground font-medium">
              {/* Not "we": this is the site describing the employer, and the
                  employer did not write it. */}
              What {company ? company.companyName : mockCompany.name} offers.
            </p>
          </div>
          <Badge variant="outline" className="hidden sm:flex rounded-full px-4 py-1 border-primary/20 bg-primary/5 text-primary font-bold text-[10px] uppercase tracking-widest">
            Total Rewards
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-8">
        {hasReal ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {realBenefits.map((label) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-4 p-3 rounded-2xl border border-transparent transition-all duration-300",
                  "hover:bg-background hover:border-border/60 hover:shadow-md hover:shadow-primary/5 group/item"
                )}
              >
                <div className="h-10 w-10 rounded-xl bg-secondary/50 flex items-center justify-center shrink-0 group-hover/item:bg-primary/10 transition-colors">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground/80 group-hover/item:text-foreground transition-colors">
                  {label}
                </span>
              </div>
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:gap-12 gap-8">
          {Object.entries(mockCompany.benefits).map(([category, items]) => (
            <div key={category} className="group">
              {/* Category Title with Decorative Underline */}
              <div className="flex items-center gap-3 mb-6">
                <h4 className="text-xs font-black uppercase tracking-[0.15em] text-foreground/70">
                  {category}
                </h4>
                <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
              </div>

              <div className="grid gap-3">
                {items.map((item) => {
                  const Icon = iconMap[item.icon] || Heart;
                  return (
                    <div 
                      key={item.label} 
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-2xl border border-transparent transition-all duration-300",
                        "hover:bg-background hover:border-border/60 hover:shadow-md hover:shadow-primary/5 group/item"
                      )}
                    >
                      {/* Stylized Icon Container */}
                      <div className="h-10 w-10 rounded-xl bg-secondary/50 flex items-center justify-center shrink-0 group-hover/item:bg-primary/10 transition-colors">
                        <Icon className="h-5 w-5 text-muted-foreground group-hover/item:text-primary transition-colors" />
                      </div>
                      
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground/80 group-hover/item:text-foreground transition-colors">
                          {item.label}
                        </span>
                        {/* Subtle Checkmark for 'Verified' feel */}
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary opacity-0 group-hover/item:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        )}

        {/* The "Last updated March 2026" line that used to sit here was hard-coded
            — the same date on every company, whatever they had actually edited. */}
        <div className="mt-10 p-5 rounded-2xl bg-muted/30 border border-dashed border-border/80 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">
            Benefits vary by location & seniority
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CompanyBenefits;