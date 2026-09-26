import { useState } from "react";
import { Star, MapPin, Users, Briefcase, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Company } from "@/data/companies/mockCompanies";
import { Link } from "react-router-dom";

interface CompanyCardProps {
  company: Company;
}

const CompanyCard = ({ company }: CompanyCardProps) => {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <Card className="group h-full flex flex-col rounded-xl border border-gray-300 dark:border-gray-700 p-5 hover:shadow-md transition-all duration-300 cursor-pointer">
      <div className="flex items-start gap-4 mb-4">
        {company.logoIcon && !logoFailed ? (
          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-muted shadow-inner flex items-center justify-center">
          <img
            src={company.logoIcon}
            alt={`${company.name} logo`}
            onError={() => setLogoFailed(true)}
            className="h-10 w-10 rounded-md object-contain"
          />
          </div>
        ) : (
          <div
            className="bg-primary h-12 w-12 rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0"
          >
            {company.logo}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-foreground truncate">{company.name}</h3>
            {company.isVerified && (
              <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" aria-label="Verified" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">{company.industry}</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">{company.tagline}</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground mb-4">
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" /> {company.location}
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {company.employeeCount}
        </span>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-sm font-medium text-foreground">
            <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
            {company.rating}
          </span>
          <Badge variant="default" className="text-xs font-normal bg-white text-foreground border border-border">
            <Briefcase className="h-3 w-3 mr-1" />
            {company.openJobs} jobs
          </Badge>
        </div>
        <Button asChild variant="default" size="sm" className="text-xs font-medium h-8 bg-orange-500 hover:bg-orange-600 text-white">
          <Link to={`/company-profile/${company.id}`}>View</Link>
        </Button>
      </div>
    </Card>
  );
};

export default CompanyCard;
