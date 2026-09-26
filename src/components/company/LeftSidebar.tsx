import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building2, Users, MapPin, Calendar, Globe, 
  Linkedin, Twitter, ExternalLink, Instagram 
} from 'lucide-react';
import { mockCompany } from '@/data/mockCompany';
import { cn } from '@/lib/utils';

const quickFacts = [
  { icon: Building2, label: 'Industry', value: mockCompany.industry },
  { icon: Users, label: 'Company Size', value: mockCompany.size },
  { icon: MapPin, label: 'Headquarters', value: mockCompany.headquarters },
  { icon: Calendar, label: 'Founded', value: mockCompany.founded.toString() },
  { icon: Globe, label: 'Offices', value: `${mockCompany.officeCount} global locations` },
];

const socialLinks = [
  { icon: Globe, label: 'Website', url: '#' },
  { icon: Linkedin, label: 'LinkedIn', url: '#' },
  { icon: Twitter, label: 'Twitter', url: '#' },
  { icon: Instagram, label: 'Instagram', url: '#' },
];

const offices = [
  { location: "San Francisco, CA", isHQ: true },
  { location: "New York, NY", isHQ: false },
  { location: "London, UK", isHQ: false },
  { location: "Toronto, Canada", isHQ: false },
  { location: "Singapore", isHQ: false },
  { location: "Berlin, Germany", isHQ: false },
];

const LeftSidebar = () => {
  return (
    <div className="space-y-6">
      {/* 1. Company Quick Facts */}
      <Card className="border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-muted/30">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">
            Company Details
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          {quickFacts.map((fact) => (
            <div key={fact.label} className="group flex items-start gap-3 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                <fact.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-tight">{fact.label}</p>
                <p className="text-sm font-medium text-foreground truncate">{fact.value}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 2. Social Links */}
      <Card className="border-border/50 rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">
            Connect With Us
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {socialLinks.map((link) => (
            <Button 
              key={link.label}
              variant="outline" 
              className="w-full justify-start gap-3 h-10 rounded-xl hover:bg-secondary border-border/60" 
              size="sm"
              asChild
            >
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                <link.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">{link.label}</span>
                <ExternalLink className="h-3 w-3 ml-auto opacity-40" />
              </a>
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* 3. Office Locations */}
      <Card className="border-border/50 rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">
            Global Offices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {offices.map((office) => (
              <li key={office.location} className="flex items-center gap-3 group">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  office.isHQ ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" : "bg-muted-foreground/30"
                )} />
                <span className={cn(
                  "text-sm transition-colors",
                  office.isHQ ? "font-semibold text-foreground" : "text-muted-foreground group-hover:text-foreground"
                )}>
                  {office.location}
                  {office.isHQ && <span className="ml-2 text-[10px] text-primary font-bold uppercase tracking-tighter">HQ</span>}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeftSidebar;