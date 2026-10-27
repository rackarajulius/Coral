import { Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  STEP_META,
  useOnboardingForm,
  OnboardingSidebar,
  StepHeader,
  StepNavigation,
  StepOne,
  StepTwo,
  StepThree,
  StepFour,
} from '@/data/onboarding';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { AccountCheckPending } from '@/components/auth/AccountCheckPending';
import { RedirectWithNotice } from '@/components/auth/RedirectWithNotice';
import { accountSide } from '@/lib/accountSide';

const PROFILE_INSTEAD_OF_ONBOARDING =
  "Your account is already set up. Add to your personal profile whenever you like.";

export default function Onboarding() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { step, completed, data, direction, submitting, set, next, back } = useOnboardingForm();

  // Redirect guards
  if (!isLoading && !isAuthenticated) return <Navigate to="/login" replace />;
  // Until the backend answers, "not onboarded" is only a placeholder. Showing
  // the form then would ask finished users to onboard again (and fail).
  if (user?.provisional) return <AccountCheckPending />;
  // This form is a new account's first steps. An employer account already has
  // its own: its personal profile is filled in from the profile page, at its
  // own pace, rather than by walking through sign-up again.
  if (accountSide(user) === 'employer') {
    return <RedirectWithNotice to="/jobseeker/profile" message={PROFILE_INSTEAD_OF_ONBOARDING} />;
  }
  if (accountSide(user) === 'provider') return <Navigate to="/provider" replace />;
  if (!isLoading && user?.status && user.status !== 'PENDING_ONBOARDING') {
    return <Navigate to="/jobseeker/profile" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <div className="container mx-auto px-4 md:px-12 lg:px-24 pt-24 pb-10">
        <main
          className="w-full grid min-[900px]:grid-cols-[320px_1fr] lg:grid-cols-[360px_1fr]
           gap-6 bg-white rounded-[28px] p-4 sm:p-6 border border-gray-200"
          aria-label="Onboarding"
        >
          <OnboardingSidebar current={step} completed={completed} />

          <section className="px-2 sm:px-6 lg:px-10 py-6 lg:py-10">
            <div className="max-w-[700px] mx-auto">
              <div
                key={step}
                className={cn(
                  'animate-in fade-in duration-300',
                  direction === 'forward' ? 'slide-in-from-right-4' : 'slide-in-from-left-4',
                )}
              >
                <StepHeader
                  step={step}
                  title={STEP_META[step - 1].title}
                  description={STEP_META[step - 1].description}
                />

                {step === 1 && <StepOne data={data} set={set} />}
                {step === 2 && <StepTwo data={data} set={set} />}
                {step === 3 && <StepThree data={data} set={set} />}
                {step === 4 && <StepFour data={data} set={set} />}
              </div>

              <StepNavigation step={step} onBack={back} onNext={next} loading={submitting} />
            </div>
          </section>
        </main>
      </div>

      <Footer />
    </div>
  );
}
