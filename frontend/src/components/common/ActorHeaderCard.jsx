import React from 'react';
import StandardBadge from '@/components/common/StandardBadge';

// Small labelled value used inside the header info row
function InfoField({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-[#7089b4]">{label}</span>
      <span className="text-sm text-[#032b71] font-medium">{value ?? '-'}</span>
    </div>
  );
}

// Matches the header card pattern used across Actor profile / Company profile / Actor detail
// pages on the live KKWA MIS: logo, name, standard label(s), and a row of key facts.
// Standard labels render as bold colored text (no pill background), per the locked
// Figma design system — see StandardBadge.
export default function ActorHeaderCard({ name, logoUrl, pills = [], fields = [], action }) {
  return (
    <div className="bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-6 mb-6" data-testid="actor-header-card">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-white border border-[#cfd8e6] flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[#0f48aa] font-black text-xl">{name?.[0]}</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-black text-[#032b71]" data-testid="actor-header-name">{name}</h2>
              {pills.map((p) => (
                <StandardBadge key={p} standard={p} />
              ))}
            </div>
          </div>
        </div>
        {action}
      </div>

      <div className="flex flex-wrap gap-x-12 gap-y-3">
        {fields.map((f) => (
          <InfoField key={f.label} label={f.label} value={f.value} />
        ))}
      </div>
    </div>
  );
}
