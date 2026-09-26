import { useState } from 'react';
import { APPLICATIONS, STATUS_META } from '@/data/jobactivity/job-activity-mock';
import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  MapPin,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { BRAND } from './constants';
import { formatShortDate } from './dates';
import { STAGES, applicationProgress } from './stages';
import CompanyMark from './CompanyMark';

type Application = (typeof APPLICATIONS)[number];

function StageProgress({ status }: { status: Application['status'] }) {
  const { index, label, tone } = applicationProgress(status);

  const segColor = (i: number) => {
    if (tone === 'rejected') return '#FCA5A5';
    if (tone === 'withdrawn') return '#E5E7EB';
    return i <= index ? BRAND : '#E5E7EB';
  };
  const labelColor =
    tone === 'rejected' ? 'text-rose-600' : tone === 'withdrawn' ? 'text-gray-500' : 'text-[#1F2937]';

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-medium ${labelColor}`}>{label}</span>
        {tone === 'active' && (
          <span className="text-xs text-muted-foreground">
            Stage {index + 1} of {STAGES.length}
          </span>
        )}
      </div>
      <div className="flex gap-1" aria-hidden>
        {STAGES.map((_, i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-full transition-colors duration-300"
            style={{ background: segColor(i) }}
          />
        ))}
      </div>
    </div>
  );
}

const ApplicationRow = ({
  a,
  onWithdraw,
}: {
  a: Application;
  onWithdraw?: (id: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const panelId = `application-${a.id}`;
  const canWithdraw = !['rejected', 'withdrawn', 'hired'].includes(a.status);

  return (
    <div className="bg-white border border-gray-300 rounded-md p-5 md:p-6 transition-all duration-300 hover:shadow-md">
      <div className="flex items-start gap-4">
        <CompanyMark letter={a.companyLogo} seed={a.company} />
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-lg text-[#1F2937] truncate">{a.job}</h3>
              <p className="text-sm text-muted-foreground truncate">
                {a.company} · {a.location}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${STATUS_META[a.status].tone}`}>
                {STATUS_META[a.status].label}
              </span>
            </div>
          </div>

          {/* Meta */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> {a.type}</span>
            <span className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> {a.salary}</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {a.remote}</span>
            <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Applied {formatShortDate(a.appliedDate)}</span>
          </div>

          {/* Progress */}
          <div className="mt-4">
            <StageProgress status={a.status} />
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Last activity {a.lastActivity}</p>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={panelId}
              className="inline-flex items-center gap-1 text-sm font-medium text-[#374151] hover:text-[#1F2937] rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-2"
            >
              {open ? 'Hide details' : 'Details'}
              <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Details */}
          {open && (
            <div id={panelId} className="mt-4 pt-4 border-t border-[#E5E7EB] animate-fade-in space-y-5">
              {/* Recruiter (shown only when a contact is known) */}
              {a.recruiter && (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#F8F9FA] border border-[#E5E7EB] flex items-center justify-center text-xs font-semibold text-[#1F2937] shrink-0">
                    {a.recruiter.avatar}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1F2937] truncate">{a.recruiter.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.recruiter.title}</p>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div>
                <p className="text-xs font-semibold text-[#1F2937] mb-3">Application timeline</p>
                <ol className="space-y-3">
                  {a.timeline.map((t, idx) => {
                    const isLast = idx === a.timeline.length - 1;
                    return (
                      <li key={idx} className="flex gap-3 text-sm">
                        {isLast ? (
                          <span className="mt-0.5 shrink-0"><span className="block w-4 h-4 rounded-full" style={{ background: BRAND }} /></span>
                        ) : (
                          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#F97316]" />
                        )}
                        <div>
                          <p className="text-[#1F2937]">{t.event}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatShortDate(t.date)}{t.note ? ` · ${t.note}` : ''}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => toast('Opening job details…')}>
                  <ExternalLink className="w-4 h-4" /> Job details
                </Button>
                <Button size="sm" variant="outline" onClick={() => toast('Downloading submitted resume…')}>
                  <Download className="w-4 h-4" /> Resume
                </Button>
                {onWithdraw && canWithdraw && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-rose-600 hover:text-rose-700"
                    onClick={() => onWithdraw(a.id)}
                  >
                    Withdraw application
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApplicationRow;
