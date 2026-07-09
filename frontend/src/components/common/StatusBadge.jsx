import React from 'react';

const STATUS_STYLES = {
  Active: { bg: '#edf9f2', text: '#219653' },
  Actual: { bg: '#edf9f2', text: '#219653' },
  Inactive: { bg: '#f5f5f5', text: '#7089b4' },
  Potential: { bg: '#fffaec', text: '#79730a' },
  Revoked: { bg: '#fff4f4', text: '#ba550c' },
};

export default function StatusBadge({ status, testId }) {
  const style = STATUS_STYLES[status] || { bg: '#f5f5f5', text: '#7089b4' };
  return (
    <span
      data-testid={testId || `status-badge-${status}`}
      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {status}
    </span>
  );
}
