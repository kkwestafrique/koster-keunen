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

export default function PhoneInput({ dialCode, number, onDialCodeChange, onNumberChange, testIdPrefix = 'phone' }) {
  return (
    <div className="flex gap-2">
      <Select value={dialCode || ''} onValueChange={onDialCodeChange}>
        <SelectTrigger data-testid={`${testIdPrefix}-dial-code`} className="w-[90px] bg-white border-[#cfd8e6] text-[#032b71] shrink-0">
          <SelectValue placeholder="+01" />
        </SelectTrigger>
        <SelectContent>
          {DIAL_CODES.map((d) => (
            <SelectItem key={d.code} value={d.code}>{d.code}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        data-testid={`${testIdPrefix}-number`}
        value={number || ''}
        onChange={(e) => onNumberChange(e.target.value)}
        placeholder="Contact number"
        className="bg-white border-[#cfd8e6] text-[#032b71]"
      />
    </div>
  );
}
