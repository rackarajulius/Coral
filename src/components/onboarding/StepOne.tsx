import { useEffect, useRef } from 'react';
import { getCountryHint } from '@/lib/api/geo';
import FieldLabel from './FieldLabel';
import BrandInput from './BrandInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { FormData } from '../../data/onboarding/types';
import { WORK_ELIGIBILITY_OPTIONS, getWorkEligibilityOption } from '@/lib/workEligibility';
import { CityAutocomplete } from '@/components/location/CityAutocomplete';
import { countryNameOf, placeParts } from '@/lib/location/places';
import { BRAND_LOCATION_INPUT_CLASSES } from './brandStyles';

const StepOne = ({ data, set }: { data: FormData; set: (d: Partial<FormData>) => void }) => {
  const eligibility = getWorkEligibilityOption(data.workEligibility);
  const hintName = data.countryHint ? countryNameOf(data.countryHint) : undefined;

  /**
   * Notes the country, and only the country.
   *
   * This used to call ipapi.co from the browser and drop "City, Region,
   * Country" into the field. Three problems: it handed every visitor's IP to a
   * third party with no consent, it was blocked by CORS so it mostly failed
   * anyway, and a guessed city silently became the person's profile location —
   * wrong for anyone on a VPN, and location feeds job matching.
   *
   * Our own endpoint reports what the CDN already resolved, stores nothing,
   * and returns null when there is no edge in front (local development). A
   * country is a fact we actually have; the city is left for the person who
   * knows it. It is kept as a hint — its cities are suggested first, and it
   * is saved as the country if no city is given — rather than typed into the
   * box: "Uganda" alone in the box was saved as the city.
   */
  const detectedRef = useRef(false);
  useEffect(() => {
    if (detectedRef.current || data.countryHint || data.location.trim()) return;
    detectedRef.current = true;

    let cancelled = false;
    getCountryHint()
      .then((code) => {
        if (cancelled || !code) return;
        set({ countryHint: code });
      })
      .catch(() => {
        /* No hint is a fine outcome: the field stays empty. */
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <FieldLabel htmlFor="fullName">Full Name</FieldLabel>
          <BrandInput
            id="fullName"
            placeholder="Enter your full name"
            value={data.fullName}
            onChange={(e) => set({ fullName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="email">Email Address</FieldLabel>
          <BrandInput
            id="email"
            type="email"
            placeholder="Enter a valid email address"
            value={data.email}
            onChange={(e) => set({ email: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="headline">Professional Headline</FieldLabel>
        <BrandInput
          id="headline"
          placeholder="Senior Frontend Engineer | React | TypeScript"
          value={data.headline}
          onChange={(e) => set({ headline: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="space-y-2">
          <FieldLabel htmlFor="location">Current Location</FieldLabel>
          <CityAutocomplete
            id="location"
            variant="field"
            inputClassName={BRAND_LOCATION_INPUT_CLASSES}
            near={data.countryHint || undefined}
            placeholder={hintName ? `Your city in ${hintName}` : 'Start typing your city'}
            value={data.location}
            onChange={(text) => set({ location: text, locationParts: null })}
            onSelect={(city) => set({ location: city.label, locationParts: placeParts(city) })}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel htmlFor="years">Years of Experience</FieldLabel>
          <BrandInput
            id="years"
            type="number"
            min={0}
            placeholder="5"
            value={data.years}
            onChange={(e) => set({ years: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel>Career Level</FieldLabel>
          <Select value={data.level} onValueChange={(v) => set({ level: v })}>
            <SelectTrigger className="bg-card">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="entry">Entry Level</SelectItem>
              <SelectItem value="mid">Mid Level</SelectItem>
              <SelectItem value="senior">Senior</SelectItem>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="executive">Executive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <FieldLabel>Work Eligibility</FieldLabel>
          <Select value={data.workEligibility} onValueChange={(v) => set({ workEligibility: v })}>
            <SelectTrigger className="bg-card">
              <SelectValue placeholder="Select your status" />
            </SelectTrigger>
            <SelectContent>
              {WORK_ELIGIBILITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {eligibility?.hasExpiry && (
          <div className="space-y-2">
            <FieldLabel htmlFor="permit-expiry">Permit valid until</FieldLabel>
            <BrandInput
              id="permit-expiry"
              type="date"
              value={data.workPermitExpiry}
              onChange={(e) => set({ workPermitExpiry: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default StepOne;
