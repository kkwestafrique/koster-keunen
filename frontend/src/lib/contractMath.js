// Single source of truth for advance_percent, used everywhere a
// contract's advance payment percentage needs to be shown or stored.
//
// Real gap found via a bug-prevention audit (Section 6/8: single
// source of truth / business logic guardrails): this exact formula was
// independently copy-pasted in three places -- useContracts.js (single
// Contract creation), useBulkUpload.js (bulk-upload validation), and
// ContractWizard.jsx (the form's own live display value). All three
// were verified identical at the time this was found, but that's
// exactly the structural risk: nothing enforced that, and the
// Standards list already drifted apart once this session before being
// consolidated the same way. A future change to this rule -- different
// rounding, different handling of a negative advance, whatever it
// turns out to be -- now only has one real place to make it.
export function calculateAdvancePercent(totalAmount, advanceAmountPaid) {
  const total = Number(totalAmount) || 0;
  const advance = Number(advanceAmountPaid) || 0;
  return total > 0 ? Math.round((advance / total) * 100) : 0;
}
