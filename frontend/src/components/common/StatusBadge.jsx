import React from 'react';

// Figma design system: status is rendered as bold colored text (no pill background)
const STATUS_COLORS = {
  Active: '#219653',
  Achieved: '#219653',
  Inactive: '#7089b4',
  Potential: '#79730a',
  Revoked: '#ba550c',
};

export default function StatusBadge({ status, testId }) {
  const color = STATUS_COLORS[status] || '#7089b4';
  return (
    <span
      data-testid={testId || `status-badge-${status}`}
      className="text-sm font-bold"
      style={{ color }}
    >
      {status}
    </span>
  );
}
