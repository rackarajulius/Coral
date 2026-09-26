import { useQuery } from '@tanstack/react-query';
import { getMyApplications } from '@/lib/api/applications';
import type { Application, AppStatus } from '@/data/jobactivity/job-activity-mock';

// Terminal states an application can no longer progress from.
const CLOSED: AppStatus[] = ['rejected', 'withdrawn', 'hired'];
// States that only exist once an employer has acted on the application.
const RESPONDED: AppStatus[] = ['under_review', 'shortlisted', 'interview_scheduled', 'offer', 'hired', 'rejected'];

interface Kpi {
  id: string;
  label: string;
  value: string | number;
  hint?: string;
}

function computeKpis(apps: Application[]): Kpi[] {
  const total = apps.length;
  const by = (fn: (s: AppStatus) => boolean) => apps.filter((a) => fn(a.status)).length;

  const active = by((s) => !CLOSED.includes(s));
  const interviews = by((s) => s === 'interview_scheduled');
  const offers = by((s) => s === 'offer' || s === 'hired');
  const responded = by((s) => RESPONDED.includes(s));
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;

  return [
    { id: 'apps', label: 'Applications Sent', value: total },
    { id: 'active', label: 'Active Applications', value: active, hint: 'In progress' },
    { id: 'interviews', label: 'Interviews', value: interviews, hint: 'At interview stage' },
    { id: 'offers', label: 'Offers Received', value: offers },
    { id: 'rate', label: 'Response Rate', value: `${responseRate}%`, hint: `${responded} of ${total} answered` },
  ];
}

const KpiStrip = () => {
  const { data: apps, isLoading } = useQuery({
    queryKey: ['my-applications'],
    queryFn: getMyApplications,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white border border-[#E5E7EB] rounded-[20px] p-4">
            <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
            <div className="mt-3 h-6 w-12 rounded bg-gray-100 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  // Nothing to summarise yet — keep the page clean for brand-new job seekers.
  if (!apps || apps.length === 0) return null;

  const kpis = computeKpis(apps);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
      {kpis.map((k) => (
        <div key={k.id} className="bg-white border border-[#E5E7EB] rounded-[20px] p-4">
          <p className="text-xs text-[#6B7280]">{k.label}</p>
          <p className="mt-1 text-lg font-bold text-[#1F2937] leading-none">{k.value}</p>
          {k.hint && <p className="mt-2 text-xs text-[#9CA3AF]">{k.hint}</p>}
        </div>
      ))}
    </div>
  );
};

export default KpiStrip;
