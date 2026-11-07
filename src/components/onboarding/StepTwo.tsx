import { useState } from 'react';
import { X } from 'lucide-react';
import type { FormData } from '../../data/onboarding/types';
import FieldLabel from './FieldLabel';
import BrandInput from './BrandInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { CityAutocomplete } from '@/components/location/CityAutocomplete';
import { BRAND_LOCATION_INPUT_CLASSES } from './brandStyles';

/** Enough to say where you'd work without turning the list into a wish list. */
const MAX_PLACES = 10;

const WORK_TYPES = ['Remote', 'Hybrid', 'Onsite'];
const EMPLOYMENT_TYPES = ['Full Time', 'Part Time', 'Contract', 'Internship'];

const StepTwo = ({ data, set }: { data: FormData; set: (d: Partial<FormData>) => void }) => {
  const [draft, setDraft] = useState('');

  /**
   * Adds a place to the list. They used to be typed as one comma-separated
   * line, which a picked "Toronto, ON" would have split into "Toronto" and "ON".
   */
  const addPlace = (place: string) => {
    const p = place.trim();
    setDraft('');
    if (!p || data.locations.some((l) => l.toLowerCase() === p.toLowerCase())) return;
    set({ locations: [...data.locations, p].slice(0, MAX_PLACES) });
  };

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
        <CityAutocomplete
          id="locs"
          variant="field"
          inputClassName={BRAND_LOCATION_INPUT_CLASSES}
          near={data.countryHint || undefined}
          placeholder="Add a city, or type “Remote” and press Enter"
          value={draft}
          onChange={setDraft}
          onSelect={(city) => addPlace(city.label)}
          onCommit={addPlace}
        />
        {data.locations.length > 0 && (
          <ul className="flex flex-wrap gap-2 pt-1" aria-label="Preferred locations">
            {data.locations.map((place) => (
              <li key={place}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm text-foreground">
                  {place}
                  <button
                    type="button"
                    onClick={() => set({ locations: data.locations.filter((p) => p !== place) })}
                    aria-label={`Remove ${place}`}
                    className="rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default StepTwo;
