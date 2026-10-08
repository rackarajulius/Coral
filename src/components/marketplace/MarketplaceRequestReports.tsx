import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { getMarketplaceMetrics, getMarketplaceRequestReports, reviewMarketplaceRequestReport } from '@/lib/api/marketplaceActivity';
import type { MarketplaceOwner } from '@/lib/api/marketplace';

export default function MarketplaceRequestReports() {
  const { user } = useAuth();
  const current = useRef(user?.id); current.current = user?.id;
  const client = useQueryClient();
  const [status, setStatus] = useState<'open' | 'reviewed'>('open');
  const active = !!user && !user.provisional && user.role === 'ADMIN' && user.status === 'ACTIVE';
  const reports = useQuery({ queryKey: ['marketplace-request-reports', user?.id, status], queryFn: ({ signal }) => getMarketplaceRequestReports(user!, status, signal), enabled: active, retry: false, staleTime: 0 });
  const metrics = useQuery({ queryKey: ['marketplace-metrics', user?.id], queryFn: ({ signal }) => getMarketplaceMetrics(user!, signal), enabled: active, retry: false, staleTime: 0 });
  const review = useMutation({ mutationFn: ({ id, owner }: { id: string; owner: MarketplaceOwner }) => reviewMarketplaceRequestReport(id, owner), onSuccess: (_, { owner }) => {
    if (current.current === owner.id) void client.invalidateQueries({ queryKey: ['marketplace-request-reports', owner.id] });
  } });
  if (!active) return null;
  return <section className="mt-8 space-y-4 border-t pt-6">
    <div><h2 className="text-lg font-semibold">Marketplace request reports</h2><p className="mt-1 text-sm text-muted-foreground">Review the details participants chose to submit. This queue does not expose their private proposals or conversations.</p></div>
    <div className="flex gap-2"><Button variant={status === 'open' ? 'default' : 'outline'} onClick={() => setStatus('open')}>Open reports</Button><Button variant={status === 'reviewed' ? 'default' : 'outline'} onClick={() => setStatus('reviewed')}>Reviewed reports</Button></div>
    {reports.isPending && <p role="status">Loading request reports…</p>}
    {reports.isError && <div role="alert"><p>Request reports could not be loaded.</p><Button variant="outline" onClick={() => void reports.refetch()}>Try again</Button></div>}
    {review.isError && <p role="alert" className="text-sm text-destructive">{review.error.message}</p>}
    {!reports.isError && reports.data?.length === 0 && <p className="rounded-xl border p-5 text-sm text-muted-foreground">No {status} request reports.</p>}
    {!reports.isError && reports.data?.map(report => <article key={report.id} className="space-y-3 rounded-xl border p-5">
      <div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium capitalize">{report.reason}</h3><span className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleString()}</span></div>
      <p className="whitespace-pre-wrap break-words text-sm">{report.details || 'No additional details submitted.'}</p>
      {report.status === 'open' && <Button variant="outline" disabled={review.isPending} onClick={() => review.mutate({ id: report.id, owner: user! })}>Mark reviewed</Button>}
    </article>)}
    <div className="rounded-xl border p-5"><h2 className="font-semibold">Marketplace activity: last 30 days</h2>
      <p className="mt-1 text-xs text-muted-foreground">Raw activity counts support pilot review. A reply does not establish a hire, contract or completed project.</p>
      {metrics.isPending && <p className="mt-3 text-sm" role="status">Loading activity…</p>}
      {metrics.isError && <div className="mt-3" role="alert"><p className="text-sm">Activity could not be loaded.</p><Button variant="outline" onClick={() => void metrics.refetch()}>Try again</Button></div>}
      {metrics.data && !metrics.isError && <>
        {!metrics.data.events.length && <p className="mt-3 text-sm text-muted-foreground">No recorded activity in this period.</p>}
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{metrics.data.events.map(event => <div key={`${event.type}:${event.source}`} className="rounded-lg bg-muted p-3"><dt className="break-words text-xs text-muted-foreground">{event.type.replace(/_/g, ' ')} · {event.source}</dt><dd className="mt-1 text-lg font-semibold">{event.count}</dd></div>)}</dl>
        <p className="mt-3 text-xs text-muted-foreground">{metrics.data.definitions.listing_view}</p>
        <p className="mt-2 text-sm">Notifications awaiting delivery: {metrics.data.pendingDeliveries}</p>
      </>}
    </div>
  </section>;
}
