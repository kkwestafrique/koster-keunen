import { useAuth } from '@/contexts/AuthContext';

// Single source of truth for "can this role do X" in the UI. Mirrors the
// real rules already enforced at the database level (RLS policies and the
// explicit role checks inside reject_transaction_with_reversal /
// approve_connection) -- this hook is a UX improvement (hide what someone
// can't use, rather than let them fill out a form and hit a raw database
// error at the end), not the actual security boundary. The database
// enforces the real rule regardless of what this hook returns.
export function usePermissions() {
  const { role } = useAuth();
  const canEdit = role === 'Admin' || role === 'Member';
  return {
    role,
    canEdit,
    canDelete: canEdit,
    canApprove: canEdit, // Approve/Reject transactions, Approve connections
    canManageTeam: role === 'Admin',
    // Gap 9: field-level change history (old value -> new value) can
    // carry beekeeper PII and full historical row snapshots, more raw
    // detail than the rest of the UI exposes -- Admin only, confirmed
    // with Babs. Mirrors the real boundary: field_change_log's own RLS
    // SELECT policy independently restricts to auth_role() = 'Admin'.
    canViewChangeHistory: role === 'Admin',
    isFieldOfficer: role === 'Field Officer',
  };
}
