// Fulfillment progress per contract line: sums quantity across the already-
// fetched (Approved-only, filtered by the caller's query) transaction rows,
// grouped by contract_id. Pure aggregation.
export function aggregateFulfillment(rows) {
  const totals = {};
  (rows || []).forEach((row) => {
    totals[row.contract_id] = (totals[row.contract_id] || 0) + Number(row.quantity || 0);
  });
  return totals;
}
