import { useEffect, useRef } from 'react';
import { getCountryHint } from '@/lib/api/geo';
import FieldLabel from './FieldLabel';
import BrandInput from './BrandInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { FormData } from '../../data/onboarding/types';
import { WORK_ELIGIBILITY_OPTIONS, getWorkEligibilityOption } from '@/lib/workEligibility';

const StepOne = ({ data, set }: { data: FormData; set: (d: Partial<FormData>) => void }) => {
  const eligibility = getWorkEligibilityOption(data.workEligibility);

  /**
   * Prefills the country, and only the country.
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
   * knows it.
   */
  const detectedRef = useRef(false);
  useEffect(() => {
    if (detectedRef.current || data.location.trim()) return;
    detectedRef.current = true;

    let cancelled = false;
    getCountryHint()
      .then((code) => {
        if (cancelled || !code) return;
        // Intl turns "UG" into "Uganda" — no country table to ship or maintain.
        const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
        if (name) set({ location: name });
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
          <BrandInput
            id="location"
            placeholder="Enter your location"
            value={data.location}
            onChange={(e) => set({ location: e.target.value })}
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
