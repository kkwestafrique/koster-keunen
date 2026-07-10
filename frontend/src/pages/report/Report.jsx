import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download } from 'lucide-react';
import { useReportData, exportToCsv } from '@/hooks/useReportData';
import { useConstants } from '@/hooks/useConstants';

export default function Report() {
  const { t } = useTranslation();
  const [year, setYear] = useState('');
  const [standard, setStandard] = useState('');

  const { data: standards = [] } = useConstants('standard');
  const { data, isLoading } = useReportData({ year, standard });

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 9 }, (_, i) => String(current - 4 + i));
  }, []);

  const summary = useMemo(() => {
    const tx = data?.transactions || [];
    const totalQuantity = tx.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);
    const totalAmount = tx.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);
    const received = tx.filter((t) => t.direction === 'Received').length;
    const sent = tx.filter((t) => t.direction === 'Send').length;
    return { totalQuantity, totalAmount, received, sent, count: tx.length };
  }, [data]);

  const handleExportTransactions = () => {
    exportToCsv(
      `transactions-report-${year || 'all'}.csv`,
      data?.transactions || [],
      [
        { key: 'transaction_date', label: 'Date' },
        { key: 'actor', label: 'Actor', accessor: (r) => r.actors?.contact_name || r.actors?.traceability_code },
        { key: 'product', label: 'Product' },
        { key: 'standard', label: 'Standard' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'unit', label: 'Unit' },
        { key: 'total_amount', label: 'Total amount' },
        { key: 'direction', label: 'Direction' },
      ]
    );
  };

  const handleExportContracts = () => {
    exportToCsv(
      `contracts-report-${year || 'all'}.csv`,
      data?.contracts || [],
      [
        { key: 'year', label: 'Year' },
        { key: 'actor', label: 'Actor', accessor: (r) => r.actors?.contact_name },
        { key: 'contract_type', label: 'Type' },
        { key: 'standard', label: 'Standard' },
        { key: 'expected_quantity', label: 'Expected quantity' },
        { key: 'total_amount', label: 'Total amount' },
      ]
    );
  };

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-4">{t('nav.report')}</h1>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Select value={year || 'all'} onValueChange={(v) => setYear(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[140px] bg-white border-[#cfd8e6] text-[#032b71]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={standard || 'all'} onValueChange={(v) => setStandard(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px] bg-white border-[#cfd8e6] text-[#032b71]">
            <SelectValue placeholder="Standard" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All standards</SelectItem>
            {standards.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-10 text-center text-sm text-[#7089b4]">
          Loading report data...
        </div>
      ) : summary.count === 0 ? (
        <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-10 text-center text-sm text-[#7089b4]">
          {t('common.noRecordsFound')}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-5">
              <p className="text-sm text-[#032b71]">Total transactions</p>
              <p className="text-2xl font-black text-[#0f48aa] mt-1">{summary.count}</p>
            </div>
            <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-5">
              <p className="text-sm text-[#032b71]">Total quantity</p>
              <p className="text-2xl font-black text-[#0f48aa] mt-1">{summary.totalQuantity.toLocaleString()}</p>
            </div>
            <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-5">
              <p className="text-sm text-[#032b71]">Total amount</p>
              <p className="text-2xl font-black text-[#0f48aa] mt-1">{summary.totalAmount.toLocaleString()}</p>
            </div>
            <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-5">
              <p className="text-sm text-[#032b71]">Received / Sent</p>
              <p className="text-2xl font-black text-[#0f48aa] mt-1">{summary.received} / {summary.sent}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="border-[#0f48aa] text-[#0f48aa]"
              onClick={handleExportTransactions}
              data-testid="export-transactions-report"
            >
              <Download className="h-4 w-4 mr-1" /> Export transactions CSV
            </Button>
            <Button
              variant="outline"
              className="border-[#0f48aa] text-[#0f48aa]"
              onClick={handleExportContracts}
              data-testid="export-contracts-report"
            >
              <Download className="h-4 w-4 mr-1" /> Export contracts CSV
            </Button>
          </div>
        </>
      )}
    </AppLayout>
  );
}
