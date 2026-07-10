import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export function useReportData({ year = '', standard = '' } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['report-data', { year, standard, supplyChainId }],
    queryFn: async () => {
      let txQuery = supabase
        .from('transactions')
        .select('transaction_date, product, standard, quantity, unit, total_amount, direction, actors(contact_name, traceability_code)')
        .eq('supply_chain_id', supplyChainId);

      if (year) txQuery = txQuery.gte('transaction_date', `${year}-01-01`).lte('transaction_date', `${year}-12-31`);
      if (standard) txQuery = txQuery.eq('standard', standard);

      const { data: transactions, error: txError } = await txQuery;
      if (txError) throw txError;

      let contractQuery = supabase
        .from('contracts')
        .select('year, standard, contract_type, expected_quantity, total_amount, actors(contact_name)')
        .eq('supply_chain_id', supplyChainId);
      if (year) contractQuery = contractQuery.eq('year', year);
      if (standard) contractQuery = contractQuery.eq('standard', standard);

      const { data: contracts, error: contractError } = await contractQuery;
      if (contractError) throw contractError;

      return { transactions: transactions || [], contracts: contracts || [] };
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

export function exportToCsv(filename, rows, columns) {
  const header = columns.map((c) => c.label).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const value = c.accessor ? c.accessor(row) : row[c.key];
          const str = value === null || value === undefined ? '' : String(value);
          return str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(',')
    )
    .join('\n');
  const csv = `${header}\n${body}`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
