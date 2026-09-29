// Turns the create-transaction form's product lines into real DB rows -- shared by
// Receive/Send/Process Stock forms (one hook, three forms, via useCreateTransaction).
// Extracted so the exact computation (quantity/price coercion, total_amount) is
// unit-tested directly, rather than only reachable through a mutation hook wired to
// a live Supabase client. Pure: no supply_chain_id or transaction_group_id lookup
// here -- those are threaded in by the caller, since they come from auth/idempotency
// concerns outside this function's job.
export function buildTransactionRows(products, sharedFields) {
  return products.map((p) => {
    const quantity = Number(p.quantity) || 0;
    const price = p.price !== '' && p.price != null ? Number(p.price) : null;
    return {
      ...sharedFields,
      product: p.converted_product ?? p.product ?? null,
      source_product: p.source_product ?? null,
      source_quantity: p.source_quantity !== undefined && p.source_quantity !== '' ? Number(p.source_quantity) : null,
      quantity,
      unit: p.unit || 'Kg',
      price,
      total_amount: price != null ? quantity * price : null,
    };
  });
}
