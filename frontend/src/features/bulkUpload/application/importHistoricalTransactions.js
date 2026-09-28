// Historical transactions need `app.bulk_import_mode` set and (for Send rows)
// auto_consume_stock_for_bulk_import() called in the SAME db transaction as the
// insert -- neither is possible through a plain client-side .insert(), so this
// calls the bulk_import_transaction RPC once per row instead of the generic
// batched insert.
//
// Pure of React/UI concerns: takes an injected client, returns a plain result.
export async function importHistoricalTransactions(client, validRows, { templateKey, options, validationErrorMessages }) {
  let inserted = 0;
  let failed = 0;
  let shortfallCount = 0;
  const errors = [...validationErrorMessages];
  for (const row of validRows) {
    const { data, error } = await client.rpc('bulk_import_transaction', {
      p_direction: row.direction,
      // receiveStock no longer carries a standard column -- the batch-level choice
      // from ReceiveStockForm's top selector is its only source. The generic
      // transactions template still has its own per-row standard, used as-is.
      p_standard: templateKey === 'receiveStock' ? options.standard : row.standard,
      p_actor_id: row.actor_id || null,
      p_beekeeper_id: row.beekeeper_id || null,
      p_product: row.product,
      p_quantity: row.quantity,
      p_unit: templateKey === 'receiveStock' ? 'Kg' : (row.unit || 'Kg'),
      p_price: row.price,
      // The Transactions template has no currency column (it's a supply-chain-wide
      // choice made once on the form) -- `row.currency` is always undefined here,
      // which supabase-js strips entirely, breaking the RPC's arg match. Callers
      // must pass the form's selected currency explicitly.
      p_currency: options.currency,
      p_transaction_date: row.transaction_date,
    });
    if (error) {
      failed += 1;
      errors.push(error.message);
    } else {
      inserted += 1;
      if (data?.stock_shortfall > 0) shortfallCount += 1;
    }
  }
  return { inserted, failed, shortfallCount, errors };
}
