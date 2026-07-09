import React from 'react';

// Figma design system: standard label is rendered as bold colored text (no pill background)
const STANDARD_COLORS = {
  Sustainable: '#79730a',
  Organic: '#1ba441',
  Conventional: '#ba550c',
};

export default function StandardBadge({ standard, testId }) {
  const color = STANDARD_COLORS[standard];
  if (!color) return null;
  return (
    <span
      data-testid={testId || `standard-badge-${standard}`}
      className="text-sm font-bold"
      style={{ color }}
    >
      {standard}
    </span>
  );
}
