import React from 'react';

// Real feedback from actual testing: "The colors for the standard are
// not highlighted enough... The background should [carry the color]
// instead of the fonts itself." Previously rendered as plain bold
// colored text with no background (an earlier, deliberate Figma design
// choice) -- changed to a colored pill (background + white text) for
// real visibility, keeping the same three colors so nothing else that
// referenced them needs to change.
// Real feedback: Sustainable felt too dark/heavy, Conventional wasn't
// red/rose enough to read clearly as its own distinct category.
// Sustainable moved to a lighter olive-yellow; Conventional moved to a
// genuine rose-red rather than the previous burnt-orange tone.
const STANDARD_COLORS = {
  Sustainable: '#a39b3a',
  Organic: '#1ba441',
  Conventional: '#c94a4a',
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
