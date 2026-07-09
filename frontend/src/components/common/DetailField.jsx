import React from 'react';

// Label/value pair used on every detail screen: label in muted #7089b4, value in navy #032b71
export default function DetailField({ label, value, testId }) {
  return (
    <div data-testid={testId} className="flex flex-col gap-1">
      <span className="text-xs font-medium text-[#7089b4]">{label}</span>
      <span className="text-sm text-[#032b71] font-medium">{value ?? '—'}</span>
    </div>
  );
}
