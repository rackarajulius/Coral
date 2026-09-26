import type { FormData } from '../../data/onboarding/types';
import FieldLabel from './FieldLabel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DEFAULT_INDUSTRIES } from '../../data/onboarding/constants';

const StepFour = ({ data, set }: { data: FormData; set: (d: Partial<FormData>) => void }) => {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <FieldLabel htmlFor="industry">Industries</FieldLabel>
        <Select value={data.industries[0] ?? ''} onValueChange={(v) => set({ industries: [v] })}>
          <SelectTrigger id="industry" className="bg-card">
            <SelectValue placeholder="Select an industry" />
          </SelectTrigger>
          <SelectContent>
            {DEFAULT_INDUSTRIES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default StepFour;
