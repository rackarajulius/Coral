import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mockCompany } from '@/data/companies/profile/mockCompany';
import { EmployerCompany } from '@/lib/api/employerCompany';

interface CompanyDiversityProps {
  company?: EmployerCompany;
}

const CompanyDiversity = ({ company }: CompanyDiversityProps) => {
  // Real company uses its own statement + stats; the mock preview shows samples.
  const commitment = company ? (company.diversityStatement ?? '') : mockCompany.diversity.commitment;
  const stats = company ? company.deiStats : mockCompany.diversity.stats;

  // A real company with no statement and no stats shouldn't show an empty card.
  if (company && !commitment && stats.length === 0) return null;

  return (
    <Card className="border-border/50 rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Diversity &amp; Inclusion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {commitment && (
          <p className="text-sm text-muted-foreground leading-relaxed">{commitment}</p>
        )}

        {stats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-2xl font-bold text-primary">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyDiversity;
