import { calculateAdvancePercent } from '@/lib/contractMath';

// Update-contract modal: builds one update payload per product line.
// total_amount is genuinely PER-LINE here (this row's own new
// expected_quantity * price), matching the original exactly -- it is
// NOT the group-wide sum, even though a separate database trigger
// (sync_contract_group_totals, added earlier in this project) silently
// recomputes and overwrites it with the true group total immediately
// after this update lands. Preserved as-is rather than "fixed" during
// extraction, since the DB trigger already makes the end result
// correct regardless of what this sends. advance_percent IS computed
// once from the whole products array and applied identically to every
// row -- that part genuinely is group-shared, matching the original's
// single call to calculateAdvancePercent. Pure: returns payloads, does
// not call Supabase.
export function buildContractUpdatePayloads(products, { advance_amount_paid, updated_at, attachment_url }) {
  const totalContractAmount = products.reduce(
    (sum, p) => sum + (Number(p.expected_quantity) || 0) * (Number(p.price) || 0), 0
  );
  const advance_percent = calculateAdvancePercent(totalContractAmount, advance_amount_paid);

  return products.map((p) => {
    const expected_quantity = Number(p.expected_quantity) || 0;
    const price = Number(p.price) || 0;
    const payload = {
      id: p.id,
      expected_quantity,
      price,
      total_amount: expected_quantity * price,
      advance_amount_paid: Number(advance_amount_paid) || 0,
      advance_percent,
      updated_at,
    };
    if (attachment_url !== undefined) payload.attachment_url = attachment_url;
    return payload;
  });
}
