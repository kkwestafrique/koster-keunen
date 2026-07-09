import React from 'react';

const STANDARD_STYLES = {
  Sustainable: { bg: '#fffaec', text: '#79730a' },
  Organic: { bg: '#edf9f2', text: '#1ba441' },
  Conventional: { bg: '#fff4f4', text: '#ba550c' },
};

export default function StandardBadge({ standard, testId }) {
  const style = STANDARD_STYLES[standard];
  if (!style) return null;
  return (
    <span
      data-testid={testId || `standard-badge-${standard}`}
      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {standard}
    </span>
  );
}
