// Collapses the multiple product-line rows a single real transaction is stored as
// (transactions is one row per product line; a "transaction" as a person means it
// is transaction_group_id's worth of rows) into the one detail-page shape the UI
// renders. Pure: takes the already-fetched rows, returns the view model -- no
// Supabase here.
export function shapeTransactionDetail(rows) {
  if (!rows.length) return null;
  const [first] = rows;
  return {
    ...first,
    products: rows.map((r) => ({
      id: r.id,
      product: r.product,
      quantity: r.quantity,
      unit: r.unit,
      price: r.price,
      total_amount: r.total_amount,
      destination_batch: r.stocks?.batch_reference,
    })),
    total_quantity: rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0),
    total_amount: rows.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0),
  };
}
