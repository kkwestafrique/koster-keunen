import React from 'react';

// Real feedback from actual testing: "The colors for the standard are
// not highlighted enough... The background should [carry the color]
// instead of the fonts itself." Previously rendered as plain bold
// colored text with no background (an earlier, deliberate Figma design
// choice) -- changed to a colored pill (background + white text) for
// real visibility, keeping the same three colors so nothing else that
// referenced them needs to change.
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
      className="text-xs font-bold text-white rounded-full px-2.5 py-0.5 inline-block"
      style={{ backgroundColor: color }}
    >
      {standard}
    </span>
  );
}
