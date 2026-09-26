import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STEPS } from '../../data/onboarding/constants';

const OnboardingSidebar = ({ current, completed }: { current: number; completed: number[] }) => {
  return (
    <aside className="relative bg-gray-100 hidden min-[900px]:flex flex-col rounded-[24px] p-8 lg:p-10 overflow-hidden">
      <div className="relative">
        {/* vertical line */}
        <div className="absolute left-[18px] bg-orange-200 top-3 bottom-3 w-px" aria-hidden />
        <ul className="space-y-7">
          {STEPS.map((step) => {
            const isDone = completed.includes(step.id);
            const isCurrent = current === step.id;
            return (
              <li key={step.id} className="relative flex items-start gap-4">
                <div
                  className={cn(
                    'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-300',
                    isDone
                      ? 'bg-orange-500 border-orange-500'
                      : isCurrent
                        ? 'bg-white border-orange-500'
                        : 'bg-white border-orange-200',
                  )}
                >
                  {isDone ? (
                    <Check className="h-4 w-4 text-white animate-in zoom-in-50 duration-200" strokeWidth={3} />
                  ) : (
                    <step.icon className="h-4 w-4 text-orange-500" />
                  )}
                </div>
                <div className="pt-1">
                  <div className="text-[14px] font-semibold leading-tight">{step.title}</div>
                  <div className="text-[12.5px] mt-1 leading-snug text-gray-500">{step.description}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
};

export default OnboardingSidebar;
