import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export function useContracts({ page = 1, pageSize = 5, search = '', year = '', standard = '', contractType = '', country = '' } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['contracts', { page, pageSize, search, year, standard, contractType, country, supplyChainId }],
    queryFn: async () => {
      // Query the contract_groups view (one row per real contract, line
      // items aggregated) rather than the raw contracts table, which is
      // one row per product line and would otherwise show a multi-product
      // contract as several separate rows.
      let query = supabase
        .from('contract_groups')
        .select('*, actors(traceability_code, contact_name)', { count: 'exact' })
        .eq('supply_chain_id', supplyChainId)
        .order('created_at', { ascending: false });

      if (year) query = query.eq('year', year);
      if (standard) query = query.eq('standard', standard);
      if (contractType) query = query.eq('contract_type', contractType);
      if (country) query = query.eq('country', country);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      let rows = data;
      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.actors?.contact_name?.toLowerCase().includes(s) ||
            r.actors?.traceability_code?.toLowerCase().includes(s)
        );
      }
      return { rows, total: count };
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

// Contract detail: contracts are stored one row per product line sharing a
// contract_group_id, but the human-readable contract_code (e.g.
// "VY75MK452J") is what the list/URL actually identify a contract by, not
// the raw UUID — matches the live site's /contracts/contract-details/{ID}
// route, where ID is this code.
export function useContract(code) {
  return useQuery({
    queryKey: ['contract', code],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('contracts')
        .select('*, actors(traceability_code, contact_name, country)')
        .eq('contract_code', code)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (!rows.length) return null;

      const [first] = rows;
      return {
        ...first,
        products: rows.map((r) => ({
          product: r.product,
          expected_quantity: r.expected_quantity,
          unit: r.unit,
          price: r.price,
        })),
        total_quantity_expected: rows.reduce((sum, r) => sum + (Number(r.expected_quantity) || 0), 0),
      };
    },
    enabled: !!code,
  });
}

// Contract creation: one row per product line (the live site's "Add more
// products" step means a single contract-creation action can cover multiple
// products), sharing a contract_group_id so the detail page can reconstruct
// the full multi-product set. Callers pass { products: [...], ...sharedFields }
// where sharedFields are the columns common to every row (year, standard,
// actor_id, currency, contract_type, country, advance_amount_paid,
// advance_percent, comments, signature_date) and each entry in `products` is
// { product, expected_quantity, unit, price }.
export function useCreateContract() {
  const queryClient = useQueryClient();
  const { supplyChainId } = useAuth();
  return useMutation({
    mutationFn: async ({ products, ...shared }) => {
      const contract_group_id = crypto.randomUUID();
      const rows = products.map((p) => {
        const expected_quantity = Number(p.expected_quantity) || 0;
        const price = p.price !== '' && p.price != null ? Number(p.price) : null;
        return {
          ...shared,
          contract_group_id,
          supply_chain_id: supplyChainId,
          product: p.product,
          expected_quantity,
          unit: p.unit || 'Kg',
          price,
          total_amount: price != null ? expected_quantity * price : null,
        };
      });
      const { data, error } = await supabase
        .from('contracts')
        .insert(rows)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data, error } = await supabase
        .from('contracts')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract', variables.id] });
    },
  });
}
