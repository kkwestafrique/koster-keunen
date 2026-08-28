import React from 'react';

// Transaction-specific status coloring (Pending/Approved/Rejected/
// Returned) — deliberately separate from components/common/StatusBadge,
// which is for Actor/Beekeeper statuses (Active/Achieved/Inactive/
// Potential/Revoked) with different semantics and colors. Extracted from
// TransactionDetail.jsx so the list page can show the same badge without
// duplicating the mapping.
const STATUS_COLORS = {
  Pending: { bg: '#fffaec', border: '#f2e4b3', text: '#79730a' },
  Approved: { bg: '#eafaf0', border: '#b8e6c9', text: '#219653' },
  Rejected: { bg: '#fdecea', border: '#f3b8b3', text: '#ba550c' },
  Returned: { bg: '#ebf6ff', border: '#cfd8e6', text: '#0f48aa' },
};

export default function TransactionStatusBadge({ status, label, testId = 'transaction-status-badge' }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.Pending;
  return (
    <span
      className="text-xs font-bold px-2.5 py-1 rounded-full border"
      style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text }}
      data-testid={testId}
    >
      {label || status}
    </span>
  );
}
