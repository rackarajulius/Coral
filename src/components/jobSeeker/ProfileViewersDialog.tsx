import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, Eye, Loader2, Lock } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getProfileViewers } from '@/lib/api/jobSeekerProfile';

/**
 * Who viewed your profile.
 *
 * Each viewer appears as much as *they* allowed: named if they opted in, as
 * their company if they are an employer on one, and not at all if they browse
 * privately — those are a count, because a count is the most that can be said
 * about them honestly.
 *
 * The whole list is withheld from someone who browses privately themselves.
 * That symmetry is the point: the same switch decides whether others see you
 * and whether you see them. Without it this is one-sided surveillance.
 */
export function ProfileViewersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const viewers = useQuery({
    queryKey: ['profile-viewers'],
    queryFn: getProfileViewers,
    enabled: open,
    retry: false,
  });

  const data = viewers.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Who viewed your profile</DialogTitle>
          <DialogDescription>
            The last 90 days. Each person shows as much as they chose to.
          </DialogDescription>
        </DialogHeader>

        {viewers.isLoading && (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading
          </p>
        )}

        {viewers.isError && (
          <p className="flex items-start gap-2 py-4 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {(viewers.error as Error).message}
          </p>
        )}

        {/* Locked: you browse privately, so this is the trade. */}
        {data?.locked && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <Lock className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-foreground">This list is off</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{data.reason}</p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/jobseeker/settings">Open settings</Link>
            </Button>
          </div>
        )}

        {data && !data.locked && (
          <div className="space-y-1">
            {data.viewers.length === 0 && data.privateCount === 0 && (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <Eye className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-foreground">Nobody yet</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                  Views are counted from the day this started — there is no history before it.
                </p>
              </div>
            )}

            {data.viewers.map((viewer) => (
              <div
                key={`${viewer.kind}-${viewer.companyId ?? viewer.name}-${viewer.lastViewedAt}`}
                className="flex items-center gap-3 rounded-lg px-1 py-2.5"
              >
                {viewer.avatarUrl ? (
                  <img src={viewer.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                  >
                    {viewer.kind === 'company' ? (
                      <Building2 className="h-4 w-4" />
                    ) : (
                      viewer.name.trim().charAt(0).toUpperCase()
                    )}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{viewer.name}</p>
                  {viewer.subtitle && (
                    <p className="truncate text-xs text-muted-foreground">{viewer.subtitle}</p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">
                    {new Date(viewer.lastViewedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  {viewer.views > 1 && (
                    <p className="text-[11px] text-muted-foreground">{viewer.views} views</p>
                  )}
                </div>
              </div>
            ))}

            {data.privateCount > 0 && (
              <p className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {data.privateCount === 1
                  ? '1 other person viewed privately.'
                  : `${data.privateCount} other people viewed privately.`}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ProfileViewersDialog;
