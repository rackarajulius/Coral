import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, DollarSign, Bookmark, ArrowRight, Briefcase, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { mockCompany } from '@/data/companies/profile/mockCompany';
import { EmployerCompany } from '@/lib/api/employerCompany';
import { listPublicJobs, PublicJob } from '@/lib/api/jobs';

interface CompanyJobsProps {
  company?: EmployerCompany;
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', CAD: 'C$' };
const PERIOD_LABELS: Record<string, string> = { yearly: 'yr', monthly: 'mo', hourly: 'hr' };

function formatEmploymentType(type: string): string {
  return type
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('-');
}

function formatSalary(job: PublicJob): string | null {
  if (!job.salaryMin && !job.salaryMax) return null;

  const symbol = CURRENCY_SYMBOLS[job.salaryCurrency] ?? job.salaryCurrency;
  const range = [job.salaryMin, job.salaryMax]
    .filter((value): value is number => !!value)
    .map((value) => `${symbol}${value.toLocaleString()}`)
    .join(' – ');

  const period = job.salaryPeriod ? PERIOD_LABELS[job.salaryPeriod] ?? job.salaryPeriod : null;
  return period ? `${range} / ${period}` : range;
}

function formatPosted(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
}

const CompanyJobs = ({ company }: CompanyJobsProps) => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<PublicJob[] | null>(null);
  const [loading, setLoading] = useState(!!company);

  useEffect(() => {
    if (!company) return;

    if (company.showJobs === false) {
      setJobs([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    listPublicJobs({ postedById: company.userId, limit: 6 })
      .then((data) => {
        if (!cancelled) setJobs(data);
      })
      .catch(() => {
        if (!cancelled) setJobs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [company]);

  const companyName = company ? company.companyName : mockCompany.name;

  const handleViewAll = () => {
    const params = new URLSearchParams({ company: companyName });
    navigate(`/jobs?${params.toString()}`);
  };

  if (!company) {
    return (
      <Card id="jobs" className="border-border rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Open Positions</CardTitle>
          <Badge variant="secondary" className="text-xs">{mockCompany.jobs.length} openings</Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mockCompany.jobs.map((job) => (
              <div
                key={job.title}
                className="group flex flex-col h-full p-4 rounded-xl border border-border hover:border-primary/30 hover:shadow-sm transition-all duration-300"
              >
                <div className="flex-1">
                  <h4 className="font-semibold text-sm group-hover:text-primary transition-colors leading-snug">{job.title}</h4>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 font-semibold text-xs text-foreground">
                    <span className="flex items-center px-2.5 py-0.5 rounded-full bg-muted gap-1"><MapPin className="h-3 w-3 shrink-0" />{job.location}</span>
                    <span className="flex items-center px-2.5 py-0.5 rounded-full bg-muted gap-1"><Clock className="h-3 w-3 shrink-0" />{job.type}</span>
                    <span className="flex items-center px-2.5 py-0.5 rounded-full bg-muted gap-1"><DollarSign className="h-3 w-3 shrink-0" />{job.salary}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">{job.department}</Badge>
                    <span className="text-xs text-muted-foreground">{job.posted}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                  <Button variant="ghost" size="icon" aria-label={`Save ${job.title}`} className="h-8 w-8 rounded-full">
                    <Bookmark className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white"
                    onClick={() => navigate(`/jobs?${new URLSearchParams({ company: companyName, title: job.title }).toString()}`)}
                  >
                    Apply
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-center">
            <Button variant="outline" className="gap-2 rounded-full" onClick={handleViewAll}>
              View All Jobs
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card id="jobs" className="border-border rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Open Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-10 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const openJobs = jobs ?? [];

  return (
    <Card id="jobs" className="border-border rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Open Positions</CardTitle>
        <Badge variant="secondary" className="text-xs">{openJobs.length} openings</Badge>
      </CardHeader>
      <CardContent>
        {openJobs.length === 0 ? (
          <div className="py-10 flex flex-col items-center gap-3 text-center text-muted-foreground">
            <Briefcase className="h-8 w-8 opacity-30" />
            <p className="text-sm font-medium">No open positions right now</p>
            <p className="text-xs">Follow this company to get notified when new roles are posted.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {openJobs.map((job) => {
                const salary = formatSalary(job);
                const location = job.location || (job.isRemote ? 'Remote' : '—');

                return (
                  <div
                    key={job.id}
                    className="group flex flex-col h-full p-4 rounded-xl border border-border hover:border-primary/30 hover:shadow-sm transition-all duration-300"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm group-hover:text-primary transition-colors leading-snug">{job.title}</h4>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 font-semibold text-xs text-foreground">
                        <span className="flex items-center px-2.5 py-0.5 rounded-full bg-muted gap-1"><MapPin className="h-3 w-3 shrink-0" />{location}</span>
                        <span className="flex items-center px-2.5 py-0.5 rounded-full bg-muted gap-1"><Clock className="h-3 w-3 shrink-0" />{formatEmploymentType(job.employmentType)}</span>
                        {salary && (
                          <span className="flex items-center px-2.5 py-0.5 rounded-full bg-muted gap-1"><DollarSign className="h-3 w-3 shrink-0" />{salary}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {job.category && <Badge variant="outline" className="text-xs">{job.category}</Badge>}
                        <span className="text-xs text-muted-foreground">{formatPosted(job.publishedAt ?? job.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                      <Button variant="ghost" size="icon" aria-label={`Save ${job.title}`} className="h-8 w-8 rounded-full">
                        <Bookmark className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={() => navigate(`/jobs?${new URLSearchParams({ company: companyName, title: job.title }).toString()}`)}
                      >
                        Apply
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 text-center">
              <Button variant="outline" className="gap-2 rounded-full" onClick={handleViewAll}>
                View All Jobs
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyJobs;
