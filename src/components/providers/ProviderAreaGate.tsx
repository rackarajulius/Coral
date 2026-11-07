import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AccountCheckPending } from '@/components/auth/AccountCheckPending';
import { RedirectWithNotice } from '@/components/auth/RedirectWithNotice';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/contexts/AuthModalContext';

/** Personal provider setup has its own destination and never changes account roles. */
export default function ProviderAreaGate() {
  const { user, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const location = useLocation();
  if (isLoading || user?.provisional) return <AccountCheckPending />;
  if (!user) return <><main className="mx-auto max-w-xl px-4 pb-16 pt-10">
    <h1 className="text-2xl font-semibold">Introduce your professional work</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in to build your provider profile and choose what to share with companies and clients.</p>
    <Button className="mt-6" onClick={() => openAuth({ redirectTo: location.pathname })}>Sign in to continue</Button>
  </main></>;
  if (user.role !== 'JOB_SEEKER' && user.role !== 'FREELANCER') {
    return <RedirectWithNotice to={user.role === 'EMPLOYER' ? '/employers/dashboard' : '/providers'} message="Provider setup is available for personal professional accounts." />;
  }
  if (user.status === 'PENDING_ONBOARDING') {
    if (user.role === 'JOB_SEEKER') return <Navigate to="/onboarding?next=provider" replace />;
    if (location.pathname !== '/provider') return <Navigate to="/provider" replace />;
    return <Outlet />;
  }
  if (user.status !== 'ACTIVE') return <><main className="mx-auto max-w-xl px-4 pb-16 pt-10">
    <h1 className="text-2xl font-semibold">Provider setup is unavailable</h1>
    <p className="mt-3 text-sm text-muted-foreground">An active personal account is required to manage a provider profile.</p>
  </main></>;
  return <Outlet />;
}
