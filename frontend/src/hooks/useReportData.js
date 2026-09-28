import { useQuery } from '@tanstack/react-query';
import ExcelJS from 'exceljs';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export function useReportData({ year = '', standard = '' } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['report-data', { year, standard, supplyChainId }],
    queryFn: async () => {
      let txQuery = supabase
        .from('transactions')
        // `actors!actor_id(...)` disambiguates the embed — `transactions`
        // has more than one FK relationship to `actors`, and an
        // unqualified `actors(...)` embed throws a PostgREST "more than
        // one relationship" error (same class of bug fixed on Contract/
        // Transaction detail), which was silently swallowed here into an
        // always-empty Report page.
        .select('transaction_date, product, standard, quantity, unit, total_amount, direction, actors!actor_id(contact_name, traceability_code)')
        .eq('supply_chain_id', supplyChainId);

      if (year) txQuery = txQuery.gte('transaction_date', `${year}-01-01`).lte('transaction_date', `${year}-12-31`);
      if (standard) txQuery = txQuery.eq('standard', standard);

      const { data: transactions, error: txError } = await txQuery;
      if (txError) throw txError;

      let contractQuery = supabase
        .from('contracts')
        .select('year, standard, contract_type, expected_quantity, total_amount, actors!actor_id(contact_name)')
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

export async function xlsxBlobFromRows(rows, columns) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Report');
  sheet.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: Math.max(14, Math.min(38, String(c.label).length + 4)),
  }));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F48AA' } };
  rows.forEach((row) => {
    sheet.addRow(columns.reduce((acc, c) => {
      const value = c.accessor ? c.accessor(row) : row[c.key];
      acc[c.key] = value === null || value === undefined ? '' : value;
      return acc;
    }, {}));
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToCsv(filename, rows, columns) {
  downloadBlob(csvBlobFromRows(rows, columns), filename);
}
