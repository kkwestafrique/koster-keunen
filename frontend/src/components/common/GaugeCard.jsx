import React from 'react';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';

// Matches the Season page spec from the Power BI handoff document:
// a ring/gauge visual, Min 0 / Max 1, formatted as a percentage,
// alongside the real achieved/potential counts underneath.
export default function GaugeCard({ label, achieved, potential, testId }) {
  const pct = potential > 0 ? achieved / potential : 0;
  const displayPct = Math.round(pct * 100);
  const data = [{ value: Math.min(pct, 1) }];

  return (
    <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-4 flex flex-col items-center gap-1" data-testid={testId}>
      <div className="relative h-24 w-24">
        <RadialBarChart
          width={96}
          height={96}
          cx="50%"
          cy="50%"
          innerRadius="70%"
          outerRadius="100%"
          barSize={10}
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 1]} angleAxisId={0} tick={false} />
          <RadialBar background dataKey="value" cornerRadius={5} fill="#0f48aa" angleAxisId={0} />
        </RadialBarChart>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-black text-[#032b71]">{displayPct}%</span>
        </div>
      </div>
      <p className="text-xs text-[#5a6f9a] text-center font-medium">{label}</p>
      <p className="text-xs text-[#5a6f9a]">{achieved.toLocaleString()} / {potential.toLocaleString()}</p>
    </div>
  );
}
