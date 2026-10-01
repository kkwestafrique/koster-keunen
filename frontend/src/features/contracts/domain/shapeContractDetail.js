// Collapses the multiple product-line rows a single real contract is stored
// as (contracts is one row per product line; a "contract" as a person means
// it is contract_group_id's worth of rows) into the one detail-page shape
// the UI renders. Pure: takes the already-fetched rows, returns the view
// model -- no Supabase here.
export function shapeContractDetail(rows) {
  if (!rows.length) return null;
  const [first] = rows;
  return {
    ...first,
    products: rows.map((r) => ({
      id: r.id,
      product: r.product,
      expected_quantity: r.expected_quantity,
      unit: r.unit,
      price: r.price,
    })),
    total_quantity_expected: rows.reduce((sum, r) => sum + (Number(r.expected_quantity) || 0), 0),
  };
}
