import { Rocket } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mockCompany } from '@/data/companies/profile/mockCompany';
import { ICON_MAP } from '@/components/employer-dashboard/companyProfile/icon-registry';
import { EmployerCompany, CompanyWhyCard } from '@/lib/api/employerCompany';

interface CompanyEVPProps {
  company?: EmployerCompany;
}

const CompanyEVP = ({ company }: CompanyEVPProps) => {
  // Real company uses its own "why work here" cards; the mock preview uses samples.
  const cards: CompanyWhyCard[] = company ? company.whyWorkHere : mockCompany.evp;

  // A real company with no cards shouldn't show an empty section.
  if (company && cards.length === 0) return null;

  return (
    <Card id="culture" className="border-border/50 rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Why Work Here</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((item, i) => {
            const Icon = (item.icon && ICON_MAP[item.icon]) || Rocket;
            return (
              <div
                key={item.id ?? `${item.title}-${i}`}
                className="group p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h4 className="font-semibold text-sm mb-1">{item.title}</h4>
                {item.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default CompanyEVP;
