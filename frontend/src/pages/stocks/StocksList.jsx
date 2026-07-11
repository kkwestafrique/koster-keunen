import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import FilterBar from '@/components/common/FilterBar';
import DataTable from '@/components/common/DataTable';
import StandardBadge from '@/components/common/StandardBadge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useStocks } from '@/hooks/useStocks';
import { useConstants } from '@/hooks/useConstants';

// Shared list for Stocks > Raw material / Final product / Loss.
export default function StocksList({ stockType, title, actionLabel, testId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('');
  const [standard, setStandard] = useState('');
  const [page, setPage] = useState(1);

  const { data: products = [] } = useConstants('product_type');
  const { data: standards = [] } = useConstants('standard');

  const { data, isLoading } = useStocks({ stockType, page, search, product, standard });

  const columns = [
    { key: 'batch_reference', label: t('stocks.batch') },
    { key: 'product', label: t('stocks.product') },
    {
      key: 'standard',
      label: t('stocks.standard'),
      render: (row) => <StandardBadge standard={row.standard} />,
    },
    {
      key: 'quantity_available',
      label: t('stocks.quantityAvailable'),
      render: (row) => (row.quantity_available != null ? `${row.quantity_available} ${row.unit || ''}` : '—'),
    },
  ];

  // Per the live-site audit: only Raw material supports Receive stock.
  // Final product and Loss are read-only lists (Select/Select all only).
  const canReceive = stockType === 'Raw Material';

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
        ]}
      />

      <DataTable
        testId={testId}
        columns={columns}
        rows={data?.rows || []}
        total={data?.total || 0}
        page={page}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage={t('common.noRecordsFound')}
      />
    </AppLayout>
  );
}
