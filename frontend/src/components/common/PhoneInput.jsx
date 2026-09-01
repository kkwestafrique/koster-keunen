import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

// Matches the live site's "Contact number" field: a country-code dropdown
// next to a plain number input. Dial codes cover the 8 countries the app
// supports (src/data/regions.js COUNTRIES).
export const DIAL_CODES = [
  { code: '+229', country: 'Benin' },
  { code: '+226', country: 'Burkina Faso' },
  { code: '+225', country: "Côte d'Ivoire" },
  { code: '+233', country: 'Ghana' },
  { code: '+223', country: 'Mali' },
  { code: '+234', country: 'Nigeria' },
  { code: '+232', country: 'Sierra Leone' },
  { code: '+228', country: 'Togo' },
];

export default function PhoneInput({ dialCode, number, onDialCodeChange, onNumberChange, testIdPrefix = 'phone', country }) {
  // Real gap found via independent audit (BUG-38): "doesn't preselect
  // from the country already chosen" -- when the form already has a
  // real Country selected elsewhere, someone still had to manually
  // pick the matching dial code again, redundant data entry for
  // information the form already had. Auto-fills it the moment a
  // country is chosen, only when no dial code has been picked yet (so
  // this never overwrites a deliberate choice).
  React.useEffect(() => {
    if (country && !dialCode) {
      const match = DIAL_CODES.find((d) => d.country === country);
      if (match) onDialCodeChange(match.code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  return (
    <div className="flex gap-2">
      <Select value={dialCode || ''} onValueChange={onDialCodeChange}>
        <SelectTrigger data-testid={`${testIdPrefix}-dial-code`} className="w-[150px] bg-white border-[#cfd8e6] text-[#032b71] shrink-0">
          {/* Real bug found live: this used to show "+01" as the
              placeholder -- indistinguishable from a real dial code
              selection (every real code in the list is +2xx). Someone
              testing the app could never tell whether they'd actually
              picked a country code or were still looking at an unset
              placeholder, and a form's Next/Submit button staying
              disabled with no visible reason looked exactly like a
              broken button. "Code" can't be mistaken for a real value. */}
          <SelectValue placeholder="Code" />
        </SelectTrigger>
        <SelectContent>
          {DIAL_CODES.map((d) => (
            <SelectItem key={d.code} value={d.code}>{d.code} ({d.country})</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        data-testid={`${testIdPrefix}-number`}
        value={number || ''}
        // Real bug found via independent audit (BUG-16): this passed
        // through raw, unfiltered keystrokes -- typing "abcxyz" got
        // saved verbatim as "+234 abcxyz". Stripped to digits only as
        // the user types, matching every real phone number this app
        // actually stores. Fixed once here since this is the one
        // shared component used everywhere a contact number is entered
        // (actors, beekeepers, profile).
        onChange={(e) => onNumberChange(e.target.value.replace(/[^0-9]/g, ''))}
        inputMode="numeric"
        placeholder="Contact number"
        className="bg-white border-[#cfd8e6] text-[#032b71]"
      />
    </div>
  );
}
