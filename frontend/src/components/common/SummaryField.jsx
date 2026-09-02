import React from 'react';

export default function SummaryField({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-[#7089b4]">{label}</span>
      <span className="text-sm text-[#032b71] font-medium">{value || '—'}</span>
    </div>
  );
}
