import { MapPin } from 'lucide-react';
import type { FormData } from '../../data/onboarding/types';
import FieldLabel from './FieldLabel';
import BrandInput from './BrandInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const WORK_TYPES = ['Remote', 'Hybrid', 'Onsite'];
const EMPLOYMENT_TYPES = ['Full Time', 'Part Time', 'Contract', 'Internship'];

const StepTwo = ({ data, set }: { data: FormData; set: (d: Partial<FormData>) => void }) => {
  const renderSelect = (
    key: 'workTypes' | 'employment',
    label: string,
    placeholder: string,
    options: string[],
  ) => {
    return (
      <div className="space-y-2">
        <FieldLabel>{label}</FieldLabel>
        <Select value={data[key][0] ?? ''} onValueChange={(v) => set({ [key]: [v] } as Partial<FormData>)}>
          <SelectTrigger className="bg-card">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <FieldLabel htmlFor="jobTitle">Desired Job Title</FieldLabel>
        <BrandInput
          id="jobTitle"
          placeholder="Enter job title"
          value={data.jobTitle}
          onChange={(e) => set({ jobTitle: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {renderSelect('workTypes', 'Preferred Work Type', 'Select work type', WORK_TYPES)}
        {renderSelect('employment', 'Employment Type', 'Select employment type', EMPLOYMENT_TYPES)}
      </div>

      <div className="space-y-2">
        <FieldLabel>Expected Salary Range (USD)</FieldLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BrandInput
            placeholder="Min e.g. 120,000"
            value={data.salaryMin}
            onChange={(e) => set({ salaryMin: e.target.value })}
          />
          <BrandInput
            placeholder="Max e.g. 180,000"
            value={data.salaryMax}
            onChange={(e) => set({ salaryMax: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="locs">Preferred Locations</FieldLabel>
        <div className="relative">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <BrandInput
            id="locs"
            className="pl-11"
            placeholder="San Francisco, New York, Remote"
            value={data.locations}
            onChange={(e) => set({ locations: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
};

export default StepTwo;
