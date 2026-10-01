import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { shapeContractDetail } from '../domain/shapeContractDetail';
import { aggregateFulfillment } from '../domain/aggregateFulfillment';

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
        // `actors!actor_id(...)` disambiguates the embed: contracts has
        // TWO foreign keys to actors (actor_id = the counterparty/supplier,
        // owning_actor_id = the actor who created this on the company's
        // behalf) — an unqualified `actors(...)` embed made PostgREST
        // error with "more than one relationship was found", which the
        // hook swallowed into a permanent stuck/false-empty state on the
        // Contract detail page (confirmed bug, iteration_4/5 test passes).
        .select('*, actors!actor_id(traceability_code, contact_name, country)')
        .eq('contract_code', code)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return shapeContractDetail(rows);
    },
    enabled: !!code,
  });
}

// "Delivery notification" tab on the Contract detail page. Product,
// delivering quantity, expected delivery date, comment — exactly the
// columns observed live on the site.
export function useContractDeliveries(contractGroupId) {
  return useQuery({
    queryKey: ['contract-deliveries', contractGroupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_delivery_notifications')
        .select('id, product, delivering_quantity, expected_delivery_date, comment')
        .eq('contract_group_id', contractGroupId)
        .order('expected_delivery_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!contractGroupId,
  });
}

// Fulfillment progress for one specific contract product-line: sum of
// quantity from every Approved transaction linked to it. Deliberately
// only counts Approved -- a Pending or Rejected transaction never
// actually happened, and counting it would overstate real progress.
export function useContractFulfillment(contractLineIds = []) {
  const { supplyChainId } = useAuth();
  const ids = contractLineIds.filter(Boolean);
  return useQuery({
    queryKey: ['contract-fulfillment', ids, supplyChainId],
    queryFn: async () => {
      if (ids.length === 0) return {};
      const { data, error } = await supabase
        .from('transactions')
        .select('contract_id, quantity')
        .eq('supply_chain_id', supplyChainId)
        .eq('status', 'Approved')
        .in('contract_id', ids);
      if (error) throw error;
      return aggregateFulfillment(data);
    },
    enabled: !!supplyChainId && ids.length > 0,
  });
}
