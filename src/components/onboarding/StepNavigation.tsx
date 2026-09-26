import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';

const StepNavigation = ({
  step,
  onBack,
  onNext,
  loading = false,
}: {
  step: number;
  onBack: () => void;
  onNext: () => void;
  loading?: boolean;
}) => {
  return (
    <div className="mt-10 pt-6 flex items-center justify-between border-t">
      <Button
        size="sm"
        variant="outline"
        onClick={onBack}
        disabled={step === 1 || loading}
        className="font-medium disabled:opacity-40 rounded-full"
      >
        Back
      </Button>

      <div className="flex items-center gap-3">
        <span className="text-[13px] hidden sm:inline text-gray-500">{step} / 4</span>
        <Button
          size="sm"
          variant="default"
          onClick={onNext}
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 font-semibold text-white rounded-full bg-orange-500 hover:bg-orange-600"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {step === 4 ? (loading ? 'Setting up…' : 'Complete Setup') : step === 1 ? 'Save and Continue' : 'Continue'}
        </Button>
      </div>
    </div>
  );
};

export default StepNavigation;
