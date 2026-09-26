import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { mockCompany } from '@/data/companies/profile/mockCompany';
import { EmployerCompany } from '@/lib/api/employerCompany';
import { ArrowRight } from 'lucide-react';
import teamImg from '@/assets/team-culture.jpg';

interface CompanyCultureProps {
  company?: EmployerCompany;
}

const CompanyCulture = ({ company }: CompanyCultureProps) => {
  const name = company ? company.companyName : mockCompany.name;
  const description = company ? company.companyCulture : mockCompany.culture.description;
  // For a real company use its own values (hidden when empty); the mock preview
  // shows sample copy + the bundled team photo.
  const philosophy = company ? company.culturePhilosophy : mockCompany.culture.philosophy;
  const collaboration = company ? company.cultureCollaboration : mockCompany.culture.collaboration;
  const teamImage = company ? company.cultureImageUrl : teamImg;

  if (company && !description && !philosophy && !collaboration && !teamImage) return null;

  return (
    <Card className="border-border/50 rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Life at {name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}

        {/* Culture image */}
        {teamImage && (
          <div className="relative rounded-xl overflow-hidden h-48">
            <img src={teamImage} alt="Team culture" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 to-transparent" />
            <p className="absolute bottom-3 left-4 text-primary-foreground text-sm font-medium">Our team in action</p>
          </div>
        )}

        {(philosophy || collaboration) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {philosophy && (
              <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                <h4 className="text-sm font-semibold mb-1.5">Work Philosophy</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{philosophy}</p>
              </div>
            )}
            {collaboration && (
              <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                <h4 className="text-sm font-semibold mb-1.5">Collaboration</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{collaboration}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyCulture;
