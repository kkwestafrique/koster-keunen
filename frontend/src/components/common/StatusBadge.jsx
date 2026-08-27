import React from 'react';

// Figma design system: status is rendered as bold colored text (no pill background)
const STATUS_COLORS = {
  Active: '#219653',
  Achieved: '#219653',
  Inactive: '#7089b4',
  Potential: '#79730a',
  Revoked: '#ba550c',
  Pending: '#79730a',
  // Real gap found live: Disabled had no color of its own, so it fell
  // through to the same default gray as Inactive -- visually
  // indistinguishable even though Disabled is the only status value
  // that actually restricts anything anywhere in the app (locks the
  // acting actor into read-only mode, checked in every write RLS
  // policy via auth_acting_actor_disabled()). Inactive and Active have
  // no functional difference at all currently.
  Disabled: '#ba550c',
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
