// Turns the Contract Wizard's product lines into real DB rows -- one row per
// product, sharing a contract_group_id. Pure: no supply_chain_id lookup or
// idempotency check here, those are threaded in by the caller.
export function buildContractRows(products, sharedFields) {
  return products.map((p) => {
    const expected_quantity = Number(p.expected_quantity) || 0;
    const price = p.price !== '' && p.price != null ? Number(p.price) : null;
    return {
      ...sharedFields,
      product: p.product,
      expected_quantity,
      unit: p.unit || 'Kg',
      price,
      total_amount: price != null ? expected_quantity * price : null,
    };
  });
}
