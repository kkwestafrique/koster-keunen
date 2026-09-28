// The generic import: insert new rows in batches, update existing ones, and report
// exactly what happened. Used by every template except historical transactions.
//
// Takes an injected client and returns a plain result -- no React state, no cache
// invalidation, no history logging. Those belong to the caller.

const BATCH_SIZE = 100; // avoid oversized payloads

export async function importRows(client, { template, validRows, supplyChainId, validationErrorMessages }) {
  let inserted = 0;
  let updated = 0;
  let failed = 0;
  const errors = [...validationErrorMessages];

  // Beekeepers only: re-uploading the same file previously created genuine duplicate
  // records (risk of double-counting / double-payment). The export/edit/re-import
  // workflow writes each existing beekeeper's real traceability_code into the file,
  // so that is the primary, stable match key; falls back to (full_name, village_id)
  // for a row with no code. Deliberately NOT fuzzy matching across near-duplicate
  // spellings -- that's a separate, larger feature (a real merge-screen UI).
  let existingByKey = new Map();
  let existingByCode = new Map();
  if (template.table === 'beekeepers' && validRows.length > 0) {
    const { data: existing, error: lookupError } = await client
      .from('beekeepers')
      .select('id, full_name, village_id, traceability_code')
      .eq('supply_chain_id', supplyChainId);
    if (!lookupError && existing) {
      existingByKey = new Map(
        existing.map((b) => [`${b.full_name?.trim().toLowerCase()}|${b.village_id}`, b.id])
      );
      existingByCode = new Map(
        existing.filter((b) => b.traceability_code).map((b) => [b.traceability_code.trim().toLowerCase(), b.id])
      );
    }
  }

  const toInsert = [];
  const toUpdate = [];
  if (existingByKey.size > 0 || existingByCode.size > 0) {
    for (const row of validRows) {
      // traceability_code is a match key only, never a field to write -- a new row's
      // code comes from the server-side generator, and an existing beekeeper's real
      // code must never be overwritten by whatever happened to be in this cell.
      const { traceability_code: rowCode, ...rowWithoutCode } = row;
      const codeKey = rowCode ? String(rowCode).trim().toLowerCase() : null;
      const nameKey = `${row.full_name?.trim().toLowerCase()}|${row.village_id}`;
      const existingId = (codeKey && existingByCode.get(codeKey)) || existingByKey.get(nameKey);
      if (existingId) {
        toUpdate.push({ id: existingId, ...rowWithoutCode });
      } else {
        toInsert.push(rowWithoutCode);
      }
    }
  } else {
    toInsert.push(...validRows.map(({ traceability_code, ...rest }) => rest));
  }

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const { error, count } = await client.from(template.table).insert(batch).select('*', { count: 'exact' });
    if (!error) {
      inserted += count ?? batch.length;
      continue;
    }
    // One bad row used to reject all 100 in its batch, so good rows were lost with
    // it. Retry this batch one row at a time: valid rows save, and each failure is
    // reported against the specific beekeeper/row it belongs to.
    for (const one of batch) {
      const { error: rowError } = await client.from(template.table).insert(one);
      if (rowError) {
        failed += 1;
        errors.push(`${one.full_name || one.product || 'Row'}: ${rowError.message}`);
      } else {
        inserted += 1;
      }
    }
  }

  // Updates go one at a time (each has a different id, so they can't be batched
  // into a single statement the way same-shape inserts can).
  for (const row of toUpdate) {
    const { id, ...patch } = row;
    const { error } = await client.from(template.table).update(patch).eq('id', id);
    if (error) {
      failed += 1;
      errors.push(`${patch.full_name || 'Row'}: ${error.message}`);
    } else {
      updated += 1;
    }
  }

  return { inserted, updated, failed, errors };
}
