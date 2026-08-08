import React from 'react';
import { Input } from '@/components/ui/input';

// Comma-formatted number display while typing (e.g. "10,000"), plus an
// inline validation error that shows IMMEDIATELY on a bad/empty value --
// not just on submit. Matches the live site's Update Contract behavior
// exactly: clearing a required quantity/price field shows "invalid
// quantity" right below the input as soon as it happens.
//
// Value is stored and passed to onChange as a plain numeric string
// (commas stripped) -- only the DISPLAY is formatted. Cursor position
// isn't preserved through reformatting (a standard, accepted trade-off
// for this kind of input, not a bug).
export default function FormattedNumberInput({ value, onChange, testId, errorMessage, required = true }) {
  const isEmpty = value === '' || value == null;
  const numeric = isEmpty ? null : Number(value);
  const isInvalid = required && (isEmpty || isNaN(numeric) || numeric <= 0);

  const displayValue = isEmpty || isNaN(numeric)
    ? (isEmpty ? '' : value)
    : numeric.toLocaleString('en-US', { maximumFractionDigits: 2 });

  const handleChange = (e) => {
    const raw = e.target.value.replace(/,/g, '');
    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
      onChange(raw);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Input
        type="text"
        inputMode="decimal"
        data-testid={testId}
        value={displayValue}
        onChange={handleChange}
      />
      {isInvalid && (
        <p className="text-xs text-[#ba550c]" data-testid={`${testId}-error`}>{errorMessage}</p>
      )}
    </div>
  );
}
