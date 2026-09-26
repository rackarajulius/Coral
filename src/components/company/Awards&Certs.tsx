import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Leaf, Shield, Trophy, Users } from 'lucide-react';
import { EmployerCompany, CompanyAward } from '@/lib/api/employerCompany';
import { cn } from '@/lib/utils';

const mockAwards: CompanyAward[] = [
  { title: "Best Places to Work", organization: "Fortune", year: "2025" },
  { title: "AI Company of the Year", organization: "TechCrunch", year: "2024" },
  { title: "Top 50 Startups", organization: "Forbes", year: "2024" },
  { title: "Most Innovative", organization: "Fast Company", year: "2023" },
];

const certifications = [
  { icon: Trophy, label: "Great Place to Work" },
  { icon: Users, label: "DEI Certified" },
  { icon: Leaf, label: "Carbon Neutral" },
  { icon: Shield, label: "SOC 2 Type II" },
];

interface AwardsProps {
  company?: EmployerCompany;
}

const Awards = ({ company }: AwardsProps) => {
  const awards: CompanyAward[] = company ? company.awards : mockAwards;
  // Certifications have no editor / DB field yet — show them only in the mock preview.
  const showCerts = !company;

  // A real company with no awards shouldn't show an empty section.
  if (company && awards.length === 0) return null;

  return (
    <div className={cn("grid gap-6", showCerts ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1")}>
      <Card className={cn("p-7 rounded-2xl border-border/60", showCerts && "lg:col-span-2")}>
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-semibold">Awards &amp; Recognition</h3>
        </div>
        <ul className="mt-5 divide-y divide-border/60">
          {awards.map((a, i) => (
            <li key={a.id ?? i} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-sm">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.organization}</p>
                {a.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                )}
              </div>
              {a.year && <Badge variant="secondary" className="rounded-full shrink-0">{a.year}</Badge>}
            </li>
          ))}
        </ul>
      </Card>

      {showCerts && (
        <Card className="p-7 rounded-2xl border-border/60">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Certifications</h3>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {certifications.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-secondary border border-border px-3 py-1.5 text-xs font-medium">
                <c.icon className="h-3.5 w-3.5" /> {c.label}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default Awards;
