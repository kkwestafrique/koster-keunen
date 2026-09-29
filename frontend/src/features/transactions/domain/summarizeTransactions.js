// Transaction Overview tab on the Dashboard: total quantity per direction for the
// selected year, plus a per-product breakdown. Pure -- moved verbatim from
// useTransactions.js, unit-tested here instead of only exercised indirectly through
// a query hook.
//
// DEFINITION (v1):
//   total       = count of transaction RECORDS (one row per product line, NOT one
//                 per real transaction -- a multi-product Send counts as multiple
//                 here). Deliberately NOT the same counting unit as
//                 transaction_groups elsewhere in the app; this answers "how much
//                 line-item activity happened", not "how many transactions
//                 happened". Never label this on screen as a transaction count
//                 without that distinction.
//   byDirection = SUM of quantity, grouped by direction (Received/Processing/Send).
//                 A physical quantity total, not a count.
//   byProduct   = SUM of quantity, grouped by product name. Also a physical
//                 quantity total.
export function summarizeTransactions(rows) {
  const byDirection = { Received: 0, Processing: 0, Send: 0 };
  const byProduct = {};
  rows.forEach((row) => {
    byDirection[row.direction] = (byDirection[row.direction] || 0) + (Number(row.quantity) || 0);
    if (row.product) byProduct[row.product] = (byProduct[row.product] || 0) + (Number(row.quantity) || 0);
  });
  return {
    total: rows.length,
    byDirection,
    byProduct: Object.entries(byProduct).map(([product, quantity]) => ({ product, quantity })),
  };
}
