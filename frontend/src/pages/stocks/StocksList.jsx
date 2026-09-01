import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import StandardBadge from '@/components/common/StandardBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { useStocks } from '@/hooks/useStocks';
import { useConstants } from '@/hooks/useConstants';
import { useAllVillagesLite } from '@/hooks/useVillages';

// Shared list for Stocks > Raw material / Final product / Loss.
export default function StocksList({ stockType, title, actionLabel, testId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('');
  const [standard, setStandard] = useState('');
  const [village, setVillage] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const { data: products = [] } = useConstants('product_type');
  const { data: standards = [] } = useConstants('standard');
  const { data: villages = [] } = useAllVillagesLite();

  const { data, isLoading } = useStocks({ stockType, page, pageSize, search, product, standard, village, dateFrom, dateTo });
  const rows = data?.rows || [];

  // Per the live-site audit: only Raw material supports Receive stock.
  // Final product and Loss are read-only lists.
  const canReceive = stockType === 'Raw Material';

  const columns = [
    { key: 'id', label: t('stocks.stockId'), render: (row) => String(row.id).slice(0, 8) },
    { key: 'batch_reference', label: t('stocks.batch') },
    { key: 'product', label: t('stocks.product') },
    {
      key: 'standard',
      label: t('stocks.standard'),
      render: (row) => <StandardBadge standard={row.standard} />,
    },
    // Real bug found via independent audit (BUG-27): "final-product
    // stock rows show Village as '—'". Confirmed the real cause: this
    // column was shown unconditionally for both stock types, but
    // Final Product is a manufactured/processed batch, not tied to a
    // geographic collection point the way Raw Material genuinely is --
    // every single Final Product row would always show "—" here,
    // making it a permanently-empty column rather than a display bug
    // in the data itself. Only shown where it's actually meaningful.
    ...(stockType === 'Raw Material' ? [{
      key: 'village',
      label: t('receiveForm.village'),
      render: (row) => row.villages?.name || '—',
    }] : []),
    {
      key: 'quantity_available',
      label: t('stocks.quantityAvailable'),
      render: (row) => (row.quantity_available != null ? `${row.quantity_available} ${row.unit || ''}` : '—'),
    },
  ];

  return (
    <AppLayout hideDefaultHeader>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-black text-[#0f48aa]">{title}</h1>
        {canReceive && (
          <Button
            data-testid={`${testId}-action-button`}
            className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]"
            onClick={() => navigate('/transactions/received/new')}
          >
            <Plus className="h-4 w-4 mr-1" /> {actionLabel}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <FilterBar
          testId={testId}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          searchPlaceholder={t('actorsList.searchPlaceholder')}
          filters={[
            {
              key: 'product',
              label: t('stocks.allProducts'),
              value: product,
              onChange: (v) => { setProduct(v); setPage(1); },
              options: products.map((p) => ({ value: p.value, label: p.label })),
            },
            {
              key: 'standard',
              label: t('stocks.allStandards'),
              value: standard,
              onChange: (v) => { setStandard(v); setPage(1); },
              options: standards.map((s) => ({ value: s.value, label: s.label })),
            },
            {
              key: 'village',
              label: t('stocks.allVillages'),
              value: village,
              onChange: (v) => { setVillage(v); setPage(1); },
              options: villages.map((v) => ({ value: v.id, label: v.country ? `${v.name} (${v.country})` : v.name })),
            },
          ]}
        />
        {/* Real feedback: "What dates are here?" -- these two fields
            used placeholder text to explain themselves, but native
            date-picker inputs largely ignore placeholder text (the
            same root cause as the "+01" phone code bug found earlier
            today). A real, always-visible label fixes this regardless
            of what the browser does with placeholders. */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#7089b4]" htmlFor={`${testId}-date-from-filter`}>{t('stocks.dateFrom')}</label>
          <Input
            id={`${testId}-date-from-filter`}
            type="date"
            data-testid={`${testId}-date-from-filter`}
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="w-[160px] bg-white border-[#cfd8e6] text-[#032b71]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#7089b4]" htmlFor={`${testId}-date-to-filter`}>{t('stocks.dateTo')}</label>
          <Input
            id={`${testId}-date-to-filter`}
            type="date"
            data-testid={`${testId}-date-to-filter`}
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="w-[160px] bg-white border-[#cfd8e6] text-[#032b71]"
          />
        </div>
      </div>

      <DataTable
        testId={testId}
        columns={columns}
        rows={rows}
        total={data?.total || 0}
        page={page}
        pageSize={pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        onRowClick={(row) => navigate(`/stocks/detail/${row.id}`)}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage={t('common.noRecordsFound')}
      />
    </AppLayout>
  );
}
